'use strict';

/**
 * Regresion de entrega por QR/token contra un entorno LOCAL o DESECHABLE.
 *
 * Requiere:
 *   SUPABASE_URL           (obligatoriamente 127.0.0.1/localhost)
 *   SUPABASE_SERVICE_KEY   (clave local, nunca Cloud)
 *   MS_PEDIDOS_URL         (por defecto http://127.0.0.1:3905)
 *
 * Crea datos identificados con el prefijo S3T6- y los elimina al final. No
 * toca Supabase Cloud ni despliega nada. Si la URL no es local, aborta.
 *
 * La regresion cubre entrega, autorizacion y auditoria.
 */

const { randomUUID } = require('node:crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MS_PEDIDOS_URL = (process.env.MS_PEDIDOS_URL || 'http://127.0.0.1:3905').replace(/\/+$/, '');

const ES_LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i;
if (!SUPABASE_URL || !ES_LOCAL.test(SUPABASE_URL)) {
  throw new Error('ABORT: SUPABASE_URL debe ser local (127.0.0.1/localhost)');
}
if (!ES_LOCAL.test(MS_PEDIDOS_URL)) {
  throw new Error('ABORT: MS_PEDIDOS_URL debe ser local (127.0.0.1/localhost)');
}
if (!SERVICE_KEY) throw new Error('Falta SUPABASE_SERVICE_KEY');

const marca = `S3T6-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const password = `S3T6-local-${randomUUID().slice(0, 12)}!`;

const api = async (ruta, opciones = {}) => {
  const res = await fetch(`${SUPABASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opciones.headers || {})
    }
  });
  const texto = await res.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  return { status: res.status, body: cuerpo };
};

const rest = (ruta, opciones) => api(`/rest/v1${ruta}`, opciones);

const insertar = async (tabla, fila) => {
  const res = await rest(`/${tabla}`, { method: 'POST', body: JSON.stringify(fila) });
  if (res.status >= 300) {
    throw new Error(`No se pudo insertar en ${tabla}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return Array.isArray(res.body) ? res.body[0] : res.body;
};

const actualizar = async (tabla, filtro, cambios) => {
  const res = await rest(`/${tabla}?${filtro}`, {
    method: 'PATCH',
    body: JSON.stringify(cambios)
  });
  if (res.status >= 300) {
    throw new Error(`No se pudo actualizar ${tabla}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return Array.isArray(res.body) ? res.body[0] : res.body;
};

const buscarUsuarioPorEmail = async (email) => {
  const res = await rest(`/usuarios?select=id,email&email=eq.${encodeURIComponent(email)}`);
  if (res.status >= 300) {
    throw new Error(`No se pudo leer el usuario ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body[0];
};

const borrar = async (ruta) => {
  await rest(ruta, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
};

const adminCrearUsuario = async (email) => {
  const res = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  if (res.status >= 300) {
    throw new Error(`No se pudo crear Auth ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
};

const iniciarSesion = async (email) => {
  const res = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res.status >= 300 || !res.body?.access_token) {
    throw new Error(`No se pudo iniciar sesion ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
};

const validar = async (credencial, jwt) => {
  const res = await fetch(`${MS_PEDIDOS_URL}/api/pedidos/validar-qr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ qr_token: credencial })
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const leerPedido = async (id) => {
  const res = await rest(`/pedidos?select=id,estado,qr_usado,entregado_en&id=eq.${id}`);
  if (res.status >= 300) throw new Error(`No se pudo leer el pedido ${id}: ${JSON.stringify(res.body)}`);
  return res.body[0];
};

const contarLogsEntregado = async (id) => {
  const res = await rest(`/logs_validacion_qr?select=id&pedido_id=eq.${id}&resultado=eq.entregado`);
  return Array.isArray(res.body) ? res.body.length : 0;
};

const resultados = [];
const datos = {
  cafeterias: [],
  usuarios: [],
  auth: [],
  pedidos: []
};

const check = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

async function crearEmpleado(sufijo, cafeteriaId) {
  const email = `s3t6.${sufijo}.${marca.toLowerCase()}@example.test`;
  const auth = await adminCrearUsuario(email);
  datos.auth.push(auth.id);

  const creado = await buscarUsuarioPorEmail(email);
  if (!creado) throw new Error(`Auth creo ${email} pero no hay fila en public.usuarios`);
  const usuario = await actualizar('usuarios', `id=eq.${creado.id}`, {
    rol_id: 2,
    nombre: 'S3T6',
    apellido: sufijo,
    activo: true
  });
  datos.usuarios.push(usuario.id);

  await insertar('cafeteria_usuarios', {
    usuario_id: usuario.id,
    cafeteria_id: cafeteriaId,
    cargo: 'Empleado de regresion',
    gestiona_pedidos_kds: true
  });

  return { id: usuario.id, email, jwt: await iniciarSesion(email) };
}

async function crearComprador() {
  const email = `s3t6.comprador.${marca.toLowerCase()}@example.test`;
  const auth = await adminCrearUsuario(email);
  datos.auth.push(auth.id);

  const usuario = await buscarUsuarioPorEmail(email);
  if (!usuario) throw new Error(`Auth creo ${email} pero no hay fila en public.usuarios`);
  datos.usuarios.push(usuario.id);
  return { id: usuario.id, email, jwt: await iniciarSesion(email) };
}

async function crearPedido({ cafeteriaId, usuarioId, estado, sufijo }) {
  const corto = `${marca}-${sufijo}`;
  const pedido = await insertar('pedidos', {
    usuario_id: usuarioId,
    cafeteria_id: cafeteriaId,
    estado,
    pago_estado: 'pagado',
    total: 8500,
    codigo_pedido: corto,
    qr_token: `QR-${corto}`,
    codigo_retiro_diario: `TOK-${sufijo}-${marca.slice(-8)}`,
    qr_usado: false
  });
  datos.pedidos.push(pedido.id);
  return pedido;
}

async function escenario(nombre, fn) {
  const antes = {};
  for (const id of datos.pedidos) antes[id] = await leerPedido(id);

  const salida = await fn();

  const despues = {};
  for (const id of datos.pedidos) despues[id] = await leerPedido(id);

  resultados.push({
    escenario: nombre,
    antes,
    despues,
    resultado: salida
  });
  return salida;
}

async function principal() {
  const cafeteriaA = await insertar('cafeterias', { nombre: `[S3T6] Cafeteria A ${marca}`, activa: true });
  datos.cafeterias.push(cafeteriaA.id);
  const cafeteriaB = await insertar('cafeterias', { nombre: `[S3T6] Cafeteria B ${marca}`, activa: true });
  datos.cafeterias.push(cafeteriaB.id);

  const empleadoA = await crearEmpleado('empleado-a', cafeteriaA.id);
  const empleadoB = await crearEmpleado('empleado-b', cafeteriaB.id);
  const comprador = await crearComprador();

  const pedidoQr = await crearPedido({ cafeteriaId: cafeteriaA.id, usuarioId: comprador.id, estado: 'listo', sufijo: 'A' });
  const pedidoToken = await crearPedido({ cafeteriaId: cafeteriaA.id, usuarioId: comprador.id, estado: 'listo', sufijo: 'B' });
  const pedidoConcurrente = await crearPedido({ cafeteriaId: cafeteriaA.id, usuarioId: comprador.id, estado: 'listo', sufijo: 'C' });
  const pedidoPendiente = await crearPedido({ cafeteriaId: cafeteriaA.id, usuarioId: comprador.id, estado: 'pendiente', sufijo: 'D' });
  const pedidoAjeno = await crearPedido({ cafeteriaId: cafeteriaA.id, usuarioId: comprador.id, estado: 'listo', sufijo: 'E' });

  await escenario('1. QR valido sobre pedido listo', async () => {
    const res = await validar(pedidoQr.qr_token, empleadoA.jwt);
    check(res.status === 200 && res.body?.valido === true, `QR valido rechazado: ${JSON.stringify(res)}`);
    const pedido = await leerPedido(pedidoQr.id);
    check(pedido.estado === 'entregado' && pedido.qr_usado === true && pedido.entregado_en, 'QR no persistio la entrega');
    check(await contarLogsEntregado(pedidoQr.id) === 1, 'QR no dejo exactamente un log entregado');
    return { status: res.status, valido: res.body.valido };
  });

  await escenario('2. Token de contingencia valido sobre otro pedido listo', async () => {
    const res = await validar(pedidoToken.codigo_retiro_diario, empleadoA.jwt);
    check(res.status === 200 && res.body?.valido === true, `Token valido rechazado: ${JSON.stringify(res)}`);
    const pedido = await leerPedido(pedidoToken.id);
    check(pedido.estado === 'entregado' && pedido.qr_usado === true && pedido.entregado_en, 'Token no persistio la entrega');
    check(await contarLogsEntregado(pedidoToken.id) === 1, 'Token no dejo exactamente un log entregado');
    return { status: res.status, valido: res.body.valido };
  });

  await escenario('3. Repeticion del QR y del token del mismo pedido ya entregado', async () => {
    const entregadoQr = await leerPedido(pedidoQr.id);
    const entregadoToken = await leerPedido(pedidoToken.id);
    const repQr = await validar(pedidoQr.qr_token, empleadoA.jwt);
    const repToken = await validar(pedidoToken.codigo_retiro_diario, empleadoA.jwt);
    check(repQr.body?.valido === false && repQr.body?.motivo === 'ya_entregado', 'Repeticion QR no rechazada');
    check(repToken.body?.valido === false && repToken.body?.motivo === 'ya_entregado', 'Repeticion token no rechazada');
    check((await leerPedido(pedidoQr.id)).entregado_en === entregadoQr.entregado_en, 'Repeticion QR reescribio entregado_en');
    check((await leerPedido(pedidoToken.id)).entregado_en === entregadoToken.entregado_en, 'Repeticion token reescribio entregado_en');
    check(await contarLogsEntregado(pedidoQr.id) === 1, 'Repeticion QR duplico el log entregado');
    check(await contarLogsEntregado(pedidoToken.id) === 1, 'Repeticion token duplico el log entregado');
    return { qr: repQr.body, token: repToken.body };
  });

  await escenario('4. La otra credencial del mismo pedido despues de entregarlo', async () => {
    const qrConToken = await validar(pedidoQr.codigo_retiro_diario, empleadoA.jwt);
    const tokenConQr = await validar(pedidoToken.qr_token, empleadoA.jwt);
    check(qrConToken.body?.motivo === 'ya_entregado', 'Token posterior al QR no rechazado');
    check(tokenConQr.body?.motivo === 'ya_entregado', 'QR posterior al token no rechazado');
    return { tokenDelPedidoQr: qrConToken.body, qrDelPedidoToken: tokenConQr.body };
  });

  await escenario('5. Dos intentos simultaneos sobre el mismo pedido', async () => {
    const [a, b] = await Promise.all([
      validar(pedidoConcurrente.qr_token, empleadoA.jwt),
      validar(pedidoConcurrente.codigo_retiro_diario, empleadoA.jwt)
    ]);
    const exitos = [a, b].filter((r) => r.body?.valido === true);
    const rechazos = [a, b].filter((r) => r.body?.valido === false);
    check(exitos.length === 1, `Concurrencia: se esperaba 1 exito, hubo ${exitos.length}`);
    check(rechazos.length === 1 && rechazos[0].body?.motivo === 'ya_entregado', 'Concurrencia: el segundo intento no fue ya_entregado');
    check(await contarLogsEntregado(pedidoConcurrente.id) === 1, 'Concurrencia duplico el log entregado');
    return { exitos: exitos.length, rechazos: rechazos.length, motivos: rechazos.map((r) => r.body.motivo) };
  });

  await escenario('6. Credencial invalida', async () => {
    const res = await validar(`NO-EXISTE-${marca}`, empleadoA.jwt);
    check(res.body?.valido === false && res.body?.motivo === 'credencial_invalida', 'Credencial invalida no rechazada');
    return { status: res.status, motivo: res.body.motivo };
  });

  await escenario('7. Pedido aun no listo', async () => {
    const res = await validar(pedidoPendiente.qr_token, empleadoA.jwt);
    check(res.body?.valido === false && res.body?.motivo === 'no_listo', 'Pedido pendiente no rechazado');
    const pedido = await leerPedido(pedidoPendiente.id);
    check(pedido.estado === 'pendiente' && pedido.qr_usado === false && !pedido.entregado_en, 'Pedido pendiente fue modificado');
    return { status: res.status, motivo: res.body.motivo };
  });

  await escenario('8. Empleado de otra cafeteria', async () => {
    const res = await validar(pedidoAjeno.qr_token, empleadoB.jwt);
    check(res.status === 200 && res.body?.valido === false && res.body?.motivo === 'sin_autorizacion', 'Empleado ajeno no fue rechazado');
    const cuerpo = JSON.stringify(res.body);
    check(!('pedido' in res.body), 'Empleado ajeno recibio datos del pedido');
    check(!cuerpo.includes('entregado_en'), 'Empleado ajeno recibio la fecha de entrega');
    check(!cuerpo.includes('"estado"'), 'Empleado ajeno recibio el estado');
    const pedido = await leerPedido(pedidoAjeno.id);
    check(pedido.estado === 'listo' && pedido.qr_usado === false && !pedido.entregado_en, 'Pedido ajeno fue modificado');
    return { status: res.status, motivo: res.body.motivo, razon: res.body.razon, incluyePedido: 'pedido' in res.body };
  });

  await escenario('9. Estudiante: rol rechazado antes de resolver la credencial', async () => {
    const conCredencialValida = await validar(pedidoAjeno.qr_token, comprador.jwt);
    const conCredencialInexistente = await validar(`NO-EXISTE-${marca}`, comprador.jwt);
    for (const res of [conCredencialValida, conCredencialInexistente]) {
      check(res.status === 200 && res.body?.valido === false && res.body?.motivo === 'sin_autorizacion', 'Estudiante no fue rechazado por rol');
      check(!('pedido' in res.body), 'Estudiante recibio datos del pedido');
    }
    const pedido = await leerPedido(pedidoAjeno.id);
    check(pedido.estado === 'listo' && pedido.qr_usado === false && !pedido.entregado_en, 'Pedido fue modificado por un estudiante');
    return {
      conCredencialValida: conCredencialValida.body,
      conCredencialInexistente: conCredencialInexistente.body
    };
  });

  return { marca, pedidos: datos.pedidos };
}

function imprimirReporte() {
  console.log(JSON.stringify({ resultados }, null, 2));
}

(async () => {
  try {
    const contexto = await principal();
    imprimirReporte();
    console.log(`\nREGRESION OK (${contexto.marca})`);
  } catch (err) {
    imprimirReporte();
    console.error(`\nREGRESION FALLIDA: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try {
      if (datos.pedidos.length) {
        await borrar(`/logs_validacion_qr?pedido_id=in.(${datos.pedidos.join(',')})`);
        await borrar(`/pedidos?id=in.(${datos.pedidos.join(',')})`);
      }
      if (datos.usuarios.length) {
        await borrar(`/cafeteria_usuarios?usuario_id=in.(${datos.usuarios.join(',')})`);
        await borrar(`/usuarios?id=in.(${datos.usuarios.join(',')})`);
      }
      if (datos.cafeterias.length) {
        await borrar(`/cafeterias?id=in.(${datos.cafeterias.join(',')})`);
      }
      for (const id of datos.auth) {
        await api(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
      }
      console.log('Datos temporales eliminados.');
    } catch (err) {
      console.error(`Limpieza incompleta: ${err.message}`);
      process.exitCode = 1;
    }
  }
})();
