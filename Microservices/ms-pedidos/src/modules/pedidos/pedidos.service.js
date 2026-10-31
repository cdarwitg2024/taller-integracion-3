'use strict';

// Interfaz publica de `shared` (namespaces). Ya no hace falta el fallback
// historico a la interfaz plana: `shared` exporta `supabase`, `httpClient` y
// `HttpError` de forma estable (ver shared/src/index.js).
const { supabase, httpClient, HttpError } = require('@coffeefaster/shared');
const { createClient } = require('@supabase/supabase-js');
const {
  normalizarEstado,
  puedeTransicionar,
  transicionesDe
} = require('./pedidos.maquina-estados');

function obtenerMsMenusUrl() {
  const url = process.env.MS_MENUS_URL;

  if (!url) {
    throw new HttpError(503, 'Configuracion de ms-menus incompleta', {
      causa: 'Se requiere MS_MENUS_URL'
    });
  }

  return url.replace(/\/+$/, '');
}

function crearClienteAutenticado(accessToken) {
  if (!accessToken) throw new HttpError(401, 'Usuario no autenticado');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new HttpError(503, 'Configuracion de Supabase incompleta', {
      causa: 'Se requieren SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY'
    });
  }

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

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
 * Valida el `:usuarioId` de `GET /usuario/:usuarioId`. Mismo criterio que
 * `validarPedidoId`. El valor identifica el RECURSO solicitado; NUNCA demuestra
 * autorizacion (la identidad autorizada sale del JWT, no de este parametro).
 */
function validarUsuarioId(valor) {
  const numero = /^\d+$/.test(String(valor)) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new HttpError(400, 'usuario_id debe ser un entero positivo', {
      detalle: `Recibido: ${valor}`
    });
  }
  return numero;
}

/**
 * Proyeccion explicita de `pedidos` para las lecturas generales
 * (`GET /`, `GET /:id`, `GET /usuario/:id`, `GET /cafeteria/:id`).
 *
 * Deliberadamente EXCLUYE las credenciales de retiro:
 *   - `qr_token`
 *   - `codigo_retiro_diario`
 * Esas solo se exponen por el endpoint dedicado `GET /:id/qr`, y unicamente al
 * estudiante propietario. Se evita `select('*')`, que devolvia la fila completa
 * (incluidas credenciales) a cualquier actor autenticado.
 *
 * Solo contiene columnas operativas confirmadas contra la BD real / el codigo
 * de los consumidores (dato de `datosFicticios/server/db.ts`, consultas de
 * Desktop/Mobile y D.2.1).
 */
const CAMPOS_PEDIDO_PUBLICOS = [
  'id',
  'usuario_id',
  'cafeteria_id',
  'estado',
  'pago_estado',
  'metodo_pago',
  'total',
  'codigo_pedido',
  'franja_retiro',
  'nota',
  'qr_usado',
  'tiempo_estimado_min',
  'tiempo_real_min',
  'creado_en',
  'inicio_preparacion_en',
  'listo_en',
  'entregado_en',
  'cancelado_en'
].join(', ');

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

  const cliente = crearClienteAutenticado(accessToken);

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
  preciosResp = await httpClient.post(
    `${obtenerMsMenusUrl()}/api/menus/precios`,
    { items },
    { timeoutMs: 3000, nombre: 'ms-menus:precios' }
  );
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

  let pedidoResultado;
  const franjaRetiro = body?.franja_retiro ?? null;
  try {
    const { data: rpcData, error: rpcError } = await cliente.rpc('procesar_pago', {
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

/**
 * GET / — coleccion de pedidos visible para el actor autenticado.
 *
 * Reglas D.5-B (la identidad y el rol salen de la BD, nunca del cliente):
 *  - estudiante (rol 1): SOLO sus propios pedidos (`usuario_id = usuarioInterno.id`).
 *  - empleado   (rol 2): pedidos de SUS cafeterias (`cafeteria_usuarios`).
 *  - dueño (3) / cualquier otro rol: 403 (no se le concede esta coleccion global).
 *
 * La consulta usa la proyeccion explicita `CAMPOS_PEDIDO_PUBLICOS`: la respuesta
 * NUNCA incluye `qr_token` ni `codigo_retiro_diario`.
 */
async function listarPedidos({ user, accessToken }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cliente = crearClienteAutenticado(accessToken);
  const usuarioInterno = await resolverUsuarioInternoObligatorio(cliente, user.authUserId);
  const rol = Number(usuarioInterno.rol_id);

  if (rol !== ROL_ESTUDIANTE && rol !== ROL_EMPLEADO) {
    throw new HttpError(403, 'No autorizado para listar pedidos');
  }

  let consulta = cliente.from('pedidos').select(CAMPOS_PEDIDO_PUBLICOS);

  if (rol === ROL_ESTUDIANTE) {
    consulta = consulta.eq('usuario_id', usuarioInterno.id);
  } else {
    const cafeteriaIds = await obtenerCafeteriasDelUsuario(cliente, usuarioInterno.id);
    if (cafeteriaIds.length === 0) return [];
    consulta = consulta.in('cafeteria_id', cafeteriaIds);
  }

  const { data, error } = await consulta.limit(100);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

/**
 * GET /:id — pedido individual.
 *
 * El `:id` identifica el recurso, no autoriza. Se resuelve primero la identidad
 * desde el JWT y luego se comprueba pertenencia:
 *  - estudiante: solo si es SU pedido.
 *  - empleado:   solo si el pedido es de una cafeteria suya.
 *  - dueño/otros: 404 (sin acceso nuevo; no se revela si el pedido existe).
 *
 * Toda denegacion individual responde 404 (no 403) para no permitir enumeracion.
 * La proyeccion excluye credenciales QR.
 */
async function obtenerPedido({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const pedidoId = validarPedidoId(id);
  const cliente = supabase.obtenerCliente();
  const usuarioInterno = await resolverUsuarioInternoObligatorio(cliente, user.authUserId);
  const rol = Number(usuarioInterno.rol_id);

  if (rol !== ROL_ESTUDIANTE && rol !== ROL_EMPLEADO) {
    throw new HttpError(404, 'Pedido no encontrado');
  }

  const { data: pedido, error } = await cliente
    .from('pedidos')
    .select(CAMPOS_PEDIDO_PUBLICOS)
    .eq('id', pedidoId)
    .maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  if (rol === ROL_ESTUDIANTE) {
    if (Number(pedido.usuario_id) !== Number(usuarioInterno.id)) {
      throw new HttpError(404, 'Pedido no encontrado');
    }
    return pedido;
  }

  // empleado: debe pertenecer a la cafeteria DEL PEDIDO.
  const pertenece = await perteneceACafeteria(cliente, usuarioInterno.id, pedido.cafeteria_id);
  if (!pertenece) throw new HttpError(404, 'Pedido no encontrado');
  return pedido;
}

/**
 * GET /cafeteria/:cafeteriaId — pedidos de una cafeteria.
 *
 * Solo un EMPLEADO que pertenezca a esa cafeteria puede listarlos. Estudiante,
 * dueño y empleado ajeno reciben 403 (es una ruta explicita de coleccion, no un
 * recurso individual: aqui si se distingue el motivo). La proyeccion excluye
 * credenciales QR.
 */
async function obtenerPedidosPorCafeteria({ user, cafeteriaId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const cafeteriaIdNum = validarCafeteriaId(cafeteriaId);
  const cliente = supabase.obtenerCliente();
  const usuarioInterno = await resolverUsuarioInternoObligatorio(cliente, user.authUserId);

  if (Number(usuarioInterno.rol_id) !== ROL_EMPLEADO) {
    throw new HttpError(403, 'No autorizado para listar pedidos de esta cafeteria');
  }

  const pertenece = await perteneceACafeteria(cliente, usuarioInterno.id, cafeteriaIdNum);
  if (!pertenece) {
    throw new HttpError(403, 'No autorizado para listar pedidos de esta cafeteria');
  }

  const { data, error } = await cliente
    .from('pedidos')
    .select(CAMPOS_PEDIDO_PUBLICOS)
    .eq('cafeteria_id', cafeteriaIdNum);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

/**
 * GET /usuario/:usuarioId — pedidos de un usuario.
 *
 * Solo el ESTUDIANTE puede consultar SU propio historial: debe cumplir
 * `Number(usuarioId) === Number(usuarioInterno.id)`. La consulta final usa el id
 * interno resuelto desde el JWT (nunca el parametro). Empleado y dueño reciben
 * 403. La proyeccion excluye credenciales QR.
 */
async function obtenerPedidosPorUsuario({ user, usuarioId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const usuarioIdNum = validarUsuarioId(usuarioId);
  const cliente = supabase.obtenerCliente();
  const usuarioInterno = await resolverUsuarioInternoObligatorio(cliente, user.authUserId);

  if (Number(usuarioInterno.rol_id) !== ROL_ESTUDIANTE) {
    throw new HttpError(403, 'No autorizado para listar pedidos de este usuario');
  }
  if (usuarioIdNum !== Number(usuarioInterno.id)) {
    throw new HttpError(403, 'No autorizado para listar pedidos de este usuario');
  }

  const { data, error } = await cliente
    .from('pedidos')
    .select(CAMPOS_PEDIDO_PUBLICOS)
    .eq('usuario_id', usuarioInterno.id);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

// Roles internos (public.usuarios.rol_id) confirmados contra la BD real:
// 1 = estudiante, 2 = empleado, 3 = dueño.
// D.3: SOLO el empleado (2) opera comandas; el dueño (3) NO recibe permisos.
// D.5-B: lecturas -> estudiante ve lo suyo; empleado ve sus cafeterias; el
// dueño NO recibe permisos nuevos (403 en colecciones, 404 en individuales).
const ROL_ESTUDIANTE = 1;
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
 * Igual que `resolverUsuarioInterno`, pero falla con 404 cuando el usuario
 * autenticado no tiene cuenta interna (coherente con `crearPedido`). Se usa en
 * todas las lecturas de D.5-B: sin cuenta interna no hay identidad ni rol, y por
 * tanto no hay autorizacion posible.
 */
async function resolverUsuarioInternoObligatorio(cliente, authUserId) {
  const usuarioInterno = await resolverUsuarioInterno(cliente, authUserId);
  if (!usuarioInterno) {
    throw new HttpError(404, 'Usuario no encontrado');
  }
  return usuarioInterno;
}

/**
 * Devuelve los `cafeteria_id` asociados al usuario interno en
 * `cafeteria_usuarios`. Un usuario sin asociaciones devuelve `[]`.
 */
async function obtenerCafeteriasDelUsuario(cliente, usuarioId) {
  const { data, error } = await cliente
    .from('cafeteria_usuarios')
    .select('cafeteria_id')
    .eq('usuario_id', usuarioId);

  if (error) {
    throw new HttpError(503, 'No se pudieron obtener las cafeterias del usuario', {
      causa: error.message
    });
  }
  return (data || []).map((fila) => fila.cafeteria_id);
}

/**
 * Comprueba la pertenencia de un usuario interno a una cafeteria concreta
 * (`cafeteria_usuarios`). Devuelve `true`/`false`; un fallo de Supabase se eleva
 * como 503. El `cafeteriaId` debe ser SIEMPRE el de la entidad autoritativa
 * (p. ej. `pedido.cafeteria_id`), nunca uno enviado por el cliente.
 */
async function perteneceACafeteria(cliente, usuarioId, cafeteriaId, mensajeError = 'No se pudo verificar la cafeteria del usuario') {
  const { data, error } = await cliente
    .from('cafeteria_usuarios')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('cafeteria_id', cafeteriaId)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, mensajeError, { causa: error.message });
  }
  return Boolean(data);
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

  const pertenece = await perteneceACafeteria(
    cliente,
    usuarioInterno.id,
    pedido.cafeteria_id,
    'No se pudo verificar la cafeteria del empleado'
  );
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

  // 5. Autorizar ANTES de comparar estados o devolver datos: service_role
  //    salta RLS. Incluso un reintento exige empleado de la cafeteria real.
  await autorizarTransicionKds(cliente, user.authUserId || user.id, pedido);

  // 6. Normalizar el estado actual para comparar (tolera datos historicos).
  const actual = normalizarEstado(pedido.estado);
  if (!actual) {
    throw new HttpError(409, `El pedido tiene un estado desconocido ('${pedido.estado}'); no se puede validar la transicion.`);
  }

  // 7. Reintento autorizado: SIN UPDATE y solo campos publicos. La fila
  //    completa puede contener qr_token u otros datos internos.
  if (actual === solicitado) {
    return Object.fromEntries(
      CAMPOS_PEDIDO_PUBLICOS.split(', ').filter((campo) =>
        Object.prototype.hasOwnProperty.call(pedido, campo)
      ).map((campo) => [campo, pedido[campo]])
    );
  }

  // 8. Validar la transicion contra la matriz, ya autorizado. Cubre tambien
  //    los estados terminales (sin destinos) -> 409.
  if (!puedeTransicionar(actual, solicitado)) {
    const permitidas = transicionesDe(actual);
    const mensaje = permitidas.length === 0
      ? `El pedido ya esta en un estado terminal ('${actual}'); no admite transiciones.`
      : `Transicion no permitida: '${actual}' -> '${solicitado}'. Transiciones validas: ${permitidas.join(', ')}.`;
    throw new HttpError(409, mensaje);
  }

  // 9. La ENTREGA (`listo -> entregado`) queda reservada para la validacion QR
  //    (D.4). El PATCH generico NO puede ejecutarla, ni siquiera para un
  //    empleado autorizado: responde 409 y no ejecuta UPDATE.
  if (solicitado === 'entregado') {
    throw new HttpError(409, 'La entrega del pedido requiere validacion QR', {
      detalle: "El estado 'entregado' solo se produce al validar el QR o token de retiro."
    });
  }

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

// Estados en los que el QR sigue siendo utilizable (aun no consumido/terminal).
// Se compara contra el slug canonico (tolera aliases historicos de lectura).
const ESTADOS_QR_DISPONIBLE = ['pendiente', 'en_preparacion', 'listo'];

/**
 * GET /:id/qr — CREDENCIAL de retiro del pedido.
 *
 * D.5-B: SOLO el estudiante propietario puede obtenerla. Empleado y dueño
 * reciben 404 (no se revela la existencia del pedido). El pedido ajeno tambien
 * responde 404. El estado debe seguir siendo utilizable (`pendiente`,
 * `en_preparacion`, `listo`); `entregado`/`cancelado` responden 409.
 *
 * Este es el UNICO endpoint que expone `qr_token`. No devuelve
 * `codigo_retiro_diario` ni genera imagen.
 */
async function obtenerQr({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const pedidoId = validarPedidoId(id);
  const cliente = supabase.obtenerCliente();
  const usuarioInterno = await resolverUsuarioInternoObligatorio(cliente, user.authUserId);

  // Se comprueba el rol ANTES de leer el pedido: asi un empleado/dueño no puede
  // distinguir un pedido existente de uno inexistente (siempre 404).
  if (Number(usuarioInterno.rol_id) !== ROL_ESTUDIANTE) {
    throw new HttpError(404, 'Pedido no encontrado');
  }

  const { data: pedido, error } = await cliente
    .from('pedidos')
    .select('id, usuario_id, estado, qr_token')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  if (Number(pedido.usuario_id) !== Number(usuarioInterno.id)) {
    throw new HttpError(404, 'Pedido no encontrado');
  }

  const estado = normalizarEstado(pedido.estado);
  if (!estado || !ESTADOS_QR_DISPONIBLE.includes(estado)) {
    throw new HttpError(409, 'El QR del pedido no esta disponible en su estado actual', {
      detalle: `estado actual: ${pedido.estado}`
    });
  }

  if (!pedido.qr_token) {
    // Pedido activo sin credencial: inconsistencia de datos. Se responde 409
    // (el recurso existe pero la credencial no esta disponible) para no
    // confundirlo con un 404 de autorizacion/existencia.
    throw new HttpError(409, 'El pedido no tiene un QR disponible');
  }

  return { qr_token: pedido.qr_token };
}

async function obtenerTokenContingencia({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const pedidoId = validarPedidoId(id);
  const cliente = supabase.obtenerCliente();
  const { data: pedido, error } = await cliente.from('pedidos')
    .select('id, usuario_id, cafeteria_id, estado, codigo_retiro_diario')
    .eq('id', pedidoId).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  const usuarioInterno = await resolverUsuarioInterno(cliente, user.authUserId);
  const autorizado = usuarioInterno && (
    Number(usuarioInterno.id) === Number(pedido.usuario_id) ||
    await perteneceACafeteria(cliente, usuarioInterno.id, pedido.cafeteria_id)
  );

  if (!autorizado) {
    throw new HttpError(403, 'No autorizado para obtener token de contingencia');
  }

  // Autorizar antes de revelar disponibilidad. Igual que QR, solo se entrega
  // la credencial persistida de un pedido activo; nunca se genera un respaldo.
  if (!ESTADOS_QR_DISPONIBLE.includes(normalizarEstado(pedido.estado))) {
    throw new HttpError(409, 'El token de contingencia no esta disponible en su estado actual');
  }
  if (!pedido.codigo_retiro_diario) {
    throw new HttpError(409, 'El pedido no tiene un token de contingencia disponible');
  }
  return { token: pedido.codigo_retiro_diario };
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
