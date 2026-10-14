'use strict';

// Interfaz publica de `shared` (namespaces). Ya no hace falta el fallback
// historico a la interfaz plana: `shared` exporta `supabase`, `httpClient` y
// `HttpError` de forma estable (ver shared/src/index.js).
const { supabase, httpClient, HttpError } = require('@coffeefaster/shared');
const {
  normalizarEstado,
  puedeTransicionar,
  transicionesDe
} = require('./pedidos.maquina-estados');

/**
 * Valida el `cafeteria_id` recibido en el body. Mismo criterio que ms-cafeterias
 * y ms-menus: entero positivo representable de forma segura en JS.
 *
 * Se rechaza 0, negativos, decimales, strings no numericos y valores mayores que
 * Number.MAX_SAFE_INTEGER (perderian precision al convertirlos y se podria
 * filtrar/crear contra OTRO id). Un valor invalido no debe llegar ni a ms-menus
 * ni a `procesar_pago`.
 */
function validarCafeteriaId(valor) {
  const numero = /^\d+$/.test(String(valor)) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new HttpError(400, 'cafeteria_id debe ser un entero positivo', {
      detalle: `Recibido: ${valor}`
    });
  }
  return numero;
}

async function crearPedido({ user, accessToken, body }) {
  if (!user || !user.authUserId) {
    throw new HttpError(401, 'Usuario no autenticado');
  }

  const { items } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Debe incluir items');
  }

  const cafeteriaId = validarCafeteriaId(body?.cafeteria_id);

  if (!body?.franja_retiro || !String(body.franja_retiro).trim()) {
    throw new HttpError(400, 'franja_retiro requerida');
  }

  const cliente = supabase.obtenerCliente();

  const { data: usuarioInterno, error: errUsuario } = await cliente
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.authUserId)
    .maybeSingle();

  if (errUsuario) {
    throw new HttpError(503, 'No se pudo obtener usuario interno', { causa: errUsuario.message });
  }
  if (!usuarioInterno) {
    throw new HttpError(404, 'Usuario no encontrado');
  }

  let preciosResp;
  try {
    preciosResp = await httpClient.post('http://ms-menus:3003/api/menus/precios', { items }, { timeoutMs: 3000, nombre: 'ms-menus:precios' });
  } catch (e) {
    if (e.status >= 400 && e.status < 500) {
      throw new HttpError(e.status, e.message, { detalle: e.detalle });
    }
    throw new HttpError(503, 'No se pudo obtener precios', { causa: e.causa || e.message });
  }

  // El stock ya no se valida aca: ms-inventario salio del stack. Si se reactiva
  // el control de stock, la verificacion va antes de llamar a `procesar_pago`.

  // `httpClient.post` devuelve { status, data }, donde `data` es el CUERPO HTTP
  // de ms-menus: { data: [{ id, nombre, precio, activo, cafeteria_id }], total }.
  // El contrato real es esa lista; NO un mapa producto_id -> precio.
  const productos = preciosResp.data?.data;
  if (!Array.isArray(productos) || productos.length === 0) {
    throw new HttpError(503, 'Respuesta invalida de ms-menus', {
      causa: 'la cotizacion no devolvio productos'
    });
  }

  // Regla de negocio: TODOS los productos del pedido deben pertenecer a la
  // cafeteria indicada por cafeteria_id. ms-menus ya garantiza que existen,
  // estan activos y no borrados (si no, responde 404); aqui se comprueba la
  // pertenencia cruzada, que ms-menus no puede validar porque /precios no recibe
  // cafeteria_id.
  const productoDeOtraCafeteria = productos.find(
    (p) => Number(p.cafeteria_id) !== cafeteriaId
  );
  if (productoDeOtraCafeteria) {
    throw new HttpError(400, 'Uno o mas productos no pertenecen a la cafeteria indicada');
  }

  // El calculo monetario NO se duplica aqui: `procesar_pago` sigue siendo la
  // autoridad transaccional del pago y obtiene los precios reales directamente
  // desde public.productos.

  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new HttpError(503, 'No se pudo procesar el pago', { causa: 'SUPABASE_PUBLISHABLE_KEY/ANON_KEY no configuradas' });
  }
  let pedidoResultado;
  const franjaRetiro = body?.franja_retiro ?? null;
  try {
    const clienteConToken = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      publishableKey,
      {
        global: { headers: { Authorization: 'Bearer ' + accessToken } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );
    const { data: rpcData, error: rpcError } = await clienteConToken.rpc('procesar_pago', {
      p_cafeteria_id: cafeteriaId,
      p_items: items,
      p_franja_retiro: franjaRetiro
    });
    if (rpcError) throw rpcError;
    pedidoResultado = rpcData;
  } catch (e) {
    throw new HttpError(503, 'No se pudo procesar el pago', { causa: e.message });
  }

  return { ok: true, pedido: pedidoResultado };
}

async function listarPedidos({ user }) {
  const cliente = supabase.obtenerCliente();
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const { data, error } = await cliente.from('pedidos').select('*').limit(100);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function obtenerPedido({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = supabase.obtenerCliente();
  const { data: pedido, error } = await cliente.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  return pedido;
}

async function obtenerPedidosPorCafeteria({ user, cafeteriaId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = supabase.obtenerCliente();
  const { data, error } = await cliente.from('pedidos').select('*').eq('cafeteria_id', cafeteriaId);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function obtenerPedidosPorUsuario({ user, usuarioId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = supabase.obtenerCliente();
  const { data, error } = await cliente.from('pedidos').select('*').eq('usuario_id', usuarioId);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function actualizarEstado({ user, id, body }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');

  // 1. El estado solicitado debe poder normalizarse a un slug canonico. Tambien
  //    se aceptan aliases historicos en la ENTRADA, pero nunca se persisten.
  const solicitado = normalizarEstado(body?.estado);
  if (!solicitado) {
    throw new HttpError(400, 'estado invalido', {
      detalle: `Recibido: ${body?.estado}`
    });
  }

  const cliente = supabase.obtenerCliente();

  // 2. Leer el pedido actual (fuente de verdad del estado).
  const { data: pedido, error } = await cliente
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  // 3. Normalizar el estado actual para comparar (tolera datos historicos).
  const actual = normalizarEstado(pedido.estado);
  if (!actual) {
    throw new HttpError(409, `El pedido tiene un estado desconocido ('${pedido.estado}'); no se puede validar la transicion.`);
  }

  // 4. Idempotencia: si ya esta en el estado solicitado, se responde el pedido
  //    actual SIN ejecutar UPDATE (tolera doble clic, reintentos, duplicados).
  if (actual === solicitado) {
    return pedido;
  }

  // 5. Validar la transicion contra la matriz. Cubre tambien los estados
  //    terminales (sin destinos) -> 409.
  if (!puedeTransicionar(actual, solicitado)) {
    const permitidas = transicionesDe(actual);
    const mensaje = permitidas.length === 0
      ? `El pedido ya esta en un estado terminal ('${actual}'); no admite transiciones.`
      : `Transicion no permitida: '${actual}' -> '${solicitado}'. Transiciones validas: ${permitidas.join(', ')}.`;
    throw new HttpError(409, mensaje);
  }

  // 6. Guardar UNICAMENTE el slug canonico. Sin timestamps en esta etapa.
  const { data: actualizado, error: errUpdate } = await cliente
    .from('pedidos')
    .update({ estado: solicitado })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (errUpdate) throw new HttpError(503, errUpdate.message);
  if (!actualizado) throw new HttpError(404, 'Pedido no encontrado');
  return actualizado;
}

async function obtenerQr({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = supabase.obtenerCliente();
  const { data: pedido, error } = await cliente.from('pedidos').select('qr_token, id').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  return { qr_token: pedido.qr_token };
}

async function obtenerTokenContingencia({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = supabase.obtenerCliente();
  const { data: pedido, error } = await cliente.from('pedidos').select('id, usuario_id, cafeteria_id').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  const usuarioIdInterno = await (async () => {
    const { data: ui } = await cliente.from('usuarios').select('id').eq('auth_user_id', user.authUserId).maybeSingle();
    return ui?.id || null;
  })();

  let autorizado = false;
  if (usuarioIdInterno && pedido.usuario_id && usuarioIdInterno === pedido.usuario_id) {
    autorizado = true;
  } else {
    try {
      const { data: cu } = await cliente
        .from('cafeteria_usuarios')
        .select('id')
        .eq('usuario_id', usuarioIdInterno)
        .eq('cafeteria_id', pedido.cafeteria_id)
        .maybeSingle();
      if (cu) autorizado = true;
    } catch (e) {
      autorizado = false;
    }
  }

  if (!autorizado) {
    throw new HttpError(403, 'No autorizado para obtener token de contingencia');
  }

  return { token: pedido.qr_token || 'token-contingencia' };
}

async function validarQr({ user, body }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const { data, error } = await supabase.obtenerCliente().rpc('log_qr_validation', { p_qr_token: body?.qr_token });
  if (error) throw new HttpError(503, error.message);
  return data;
}

module.exports = {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  obtenerPedidosPorCafeteria,
  obtenerPedidosPorUsuario,
  actualizarEstado,
  obtenerQr,
  obtenerTokenContingencia,
  validarQr
};
