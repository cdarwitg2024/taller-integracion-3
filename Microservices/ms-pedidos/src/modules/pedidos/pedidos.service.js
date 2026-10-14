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

/**
 * Valida el `:id` de pedido recibido por la ruta. Mismo criterio que
 * `validarCafeteriaId`: entero positivo representable de forma segura en JS.
 * Se valida ANTES de invocar la RPC `cancelar_pedido(BIGINT)` para no enviar
 * a Postgres un valor que no puede castearse a BIGINT.
 */
function validarPedidoId(valor) {
  const numero = /^\d+$/.test(String(valor)) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new HttpError(400, 'id de pedido debe ser un entero positivo', {
      detalle: `Recibido: ${valor}`
    });
  }
  return numero;
}

/**
 * Mapeo de los motivos que devuelve la RPC `cancelar_pedido` (JSONB con
 * `ok:false`) a codigos HTTP. `sin_sesion` NO aparece aca: la RPC lo lanza como
 * EXCEPCION (SQLSTATE 42501), no como respuesta `ok:false`.
 */
const MAPA_ERRORES_CANCELACION = {
  pedido_no_encontrado: 404,
  no_autorizado: 403,
  ya_cancelado: 409,
  no_cancelable: 409,
  monto_invalido: 422,
  monto_no_entero: 422,
  saldo_invalido: 422,
  sin_wallet: 503
};

/**
 * Cancela un pedido del estudiante invocando la RPC transaccional
 * `public.cancelar_pedido(p_pedido_id)`, que reembolsa el monto a su Wallet.
 *
 * Puntos clave:
 *  - Se usa un cliente Supabase AUTENTICADO con el JWT real del estudiante
 *    (NUNCA `service_role`, que simularia la identidad y saltaria RLS).
 *  - La RPC resuelve al usuario con `auth.uid()` y valida propiedad + estado,
 *    por lo que NO se confia en ningun `usuario_id` recibido del cliente.
 *  - NUNCA se hace UPDATE directo de `estado` a 'cancelado'.
 */
async function cancelarPedido({ accessToken, id }) {
  const pedidoId = validarPedidoId(id);

  if (!accessToken) {
    throw new HttpError(401, 'Usuario no autenticado');
  }

  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new HttpError(503, 'No se pudo cancelar el pedido', {
      causa: 'SUPABASE_PUBLISHABLE_KEY/ANON_KEY no configuradas'
    });
  }

  let rpcData;
  try {
    const clienteConToken = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      publishableKey,
      {
        global: { headers: { Authorization: 'Bearer ' + accessToken } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );
    const { data, error } = await clienteConToken.rpc('cancelar_pedido', {
      p_pedido_id: pedidoId
    });

    if (error) {
      // `sin_sesion` se lanza con ERRCODE 42501 (insufficient_privilege).
      const esSinSesion = error.code === '42501' || /sin_sesion/i.test(error.message || '');
      if (esSinSesion) {
        throw new HttpError(403, 'La sesion no tiene usuario interno asociado', {
          causa: error.message
        });
      }
      throw new HttpError(503, 'No se pudo cancelar el pedido', { causa: error.message });
    }
    rpcData = data;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, 'No se pudo cancelar el pedido', { causa: e.message });
  }

  if (!rpcData || typeof rpcData !== 'object') {
    throw new HttpError(503, 'Respuesta invalida de cancelar_pedido');
  }

  if (rpcData.ok === true) {
    // { ok:true, pedido_id, estado:'cancelado', monto_reembolsado, saldo_nuevo }
    return rpcData;
  }

  const status = MAPA_ERRORES_CANCELACION[rpcData.motivo] || 503;
  const detalle = rpcData.estado_actual
    ? `motivo: ${rpcData.motivo}; estado_actual: ${rpcData.estado_actual}`
    : `motivo: ${rpcData.motivo}`;
  throw new HttpError(status, 'No se pudo cancelar el pedido', {
    motivo: rpcData.motivo,
    estado_actual: rpcData.estado_actual,
    detalle
  });
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

// Rol interno (public.usuarios.rol_id) que puede ejecutar las transiciones de
// cocina. Confirmado contra la BD real: 1=estudiante, 2=empleado, 3=dueño.
// En D.3 SOLO el empleado opera comandas: el dueño NO recibe permisos nuevos.
const ROL_EMPLEADO = 2;

/**
 * Resuelve la fila interna de `public.usuarios` a partir del UUID de auth
 * (`req.user.authUserId`). Devuelve `null` si el usuario autenticado no tiene
 * una cuenta interna asociada.
 *
 * NUNCA se confia en un rol/usuario_id/cafeteria_id enviado por el cliente: la
 * identidad y el rol salen de la base de datos.
 */
async function resolverUsuarioInterno(cliente, authUserId) {
  const { data, error } = await cliente
    .from('usuarios')
    .select('id, rol_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, 'No se pudo resolver el usuario interno', {
      causa: error.message
    });
  }
  return data || null;
}

/**
 * Autoriza una transicion KDS (no-cancelacion) ANTES de tocar la base.
 *
 * Esta validacion vive en Node porque ms-pedidos escribe con el cliente
 * server-side (`service_role`), que SALTA RLS: la unica barrera posible es esta.
 *
 * Reglas:
 *  - El usuario autenticado debe tener cuenta interna (`usuarios`).
 *  - Debe ser EMPLEADO (rol_id = 2).
 *  - Debe pertenecer a la cafeteria DEL PEDIDO (`cafeteria_usuarios`); el
 *    `cafeteria_id` autoritativo es `pedido.cafeteria_id`, nunca el del body.
 */
async function autorizarTransicionKds(cliente, authUserId, pedido) {
  const usuarioInterno = await resolverUsuarioInterno(cliente, authUserId);
  if (!usuarioInterno) {
    // Coherente con `crearPedido`, que tambien responde 404 cuando el usuario
    // autenticado no tiene fila interna.
    throw new HttpError(404, 'Usuario no encontrado');
  }

  if (Number(usuarioInterno.rol_id) !== ROL_EMPLEADO) {
    throw new HttpError(403, 'Solo un empleado puede cambiar el estado del pedido');
  }

  const { data: pertenece, error } = await cliente
    .from('cafeteria_usuarios')
    .select('id')
    .eq('usuario_id', usuarioInterno.id)
    .eq('cafeteria_id', pedido.cafeteria_id)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, 'No se pudo verificar la cafeteria del empleado', {
      causa: error.message
    });
  }
  if (!pertenece) {
    throw new HttpError(403, 'El empleado no pertenece a la cafeteria del pedido');
  }

  return usuarioInterno;
}

async function actualizarEstado({ user, accessToken, id, body }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');

  // 1. El `:id` debe ser un entero positivo antes de tocar la base.
  const pedidoId = validarPedidoId(id);

  // 2. El estado solicitado debe poder normalizarse a un slug canonico. Tambien
  //    se aceptan aliases historicos en la ENTRADA, pero nunca se persisten.
  const solicitado = normalizarEstado(body?.estado);
  if (!solicitado) {
    throw new HttpError(400, 'estado invalido', {
      detalle: `Recibido: ${body?.estado}`
    });
  }

  // 3. La CANCELACION no se hace con UPDATE directo: es una operacion
  //    transaccional (reembolso a Wallet) que vive en la RPC `cancelar_pedido`.
  //    La RPC valida propiedad y estado con el JWT real del estudiante.
  //    (Flujo D.2.1: sin cambios.)
  if (solicitado === 'cancelado') {
    return cancelarPedido({ accessToken, id });
  }

  const cliente = supabase.obtenerCliente();

  // 4. Leer el pedido actual (fuente de verdad del estado y de la cafeteria).
  const { data: pedido, error } = await cliente
    .from('pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  // 5. Normalizar el estado actual para comparar (tolera datos historicos).
  const actual = normalizarEstado(pedido.estado);
  if (!actual) {
    throw new HttpError(409, `El pedido tiene un estado desconocido ('${pedido.estado}'); no se puede validar la transicion.`);
  }

  // 6. Idempotencia: si ya esta en el estado solicitado, se responde el pedido
  //    actual SIN ejecutar UPDATE (tolera doble clic, reintentos, duplicados).
  //    No hay cambio de estado, por lo que no se requiere autorizacion KDS.
  if (actual === solicitado) {
    return pedido;
  }

  // 7. Validar la transicion contra la matriz. Cubre tambien los estados
  //    terminales (sin destinos) -> 409. Se ejecuta ANTES de autorizar para que
  //    una transicion imposible devuelva 409 sin filtrar el resultado de la
  //    autorizacion.
  if (!puedeTransicionar(actual, solicitado)) {
    const permitidas = transicionesDe(actual);
    const mensaje = permitidas.length === 0
      ? `El pedido ya esta en un estado terminal ('${actual}'); no admite transiciones.`
      : `Transicion no permitida: '${actual}' -> '${solicitado}'. Transiciones validas: ${permitidas.join(', ')}.`;
    throw new HttpError(409, mensaje);
  }

  // 8. La ENTREGA (`listo -> entregado`) queda reservada para la validacion QR
  //    (D.4). El PATCH generico NO puede ejecutarla, ni siquiera para un
  //    empleado. Se rechaza ANTES de autorizar para que cualquier actor reciba
  //    un 409 coherente.
  if (solicitado === 'entregado') {
    throw new HttpError(409, 'La entrega del pedido requiere validacion QR', {
      detalle: "El estado 'entregado' solo se produce al validar el QR o token de retiro."
    });
  }

  // 9. Autorizacion de negocio ANTES de cualquier UPDATE: empleado de la
  //    cafeteria del pedido. (service_role saltaria RLS: la unica barrera es
  //    esta validacion en Node.)
  await autorizarTransicionKds(cliente, user.authUserId || user.id, pedido);

  // 10. Guardar UNICAMENTE el slug canonico, ya autorizado. Sin timestamps en
  //     esta etapa.
  const { data: actualizado, error: errUpdate } = await cliente
    .from('pedidos')
    .update({ estado: solicitado })
    .eq('id', pedidoId)
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
