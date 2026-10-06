'use strict';

const { obtenerCliente } = require('@coffeefaster/shared').supabase || require('@coffeefaster/shared');
const httpClient = require('@coffeefaster/shared').httpClient || require('@coffeefaster/shared/src/http-client');
const { HttpError } = require('@coffeefaster/shared');

async function crearPedido({ user, accessToken, body }) {
  if (!user || !user.authUserId) {
    throw new HttpError(401, 'Usuario no autenticado');
  }

  const { items } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Debe incluir items');
  }
  if (!body?.cafeteria_id) {
    throw new HttpError(400, 'cafeteria_id requerido');
  }
  if (!body?.franja_retiro || !String(body.franja_retiro).trim()) {
    throw new HttpError(400, 'franja_retiro requerida');
  }

  const supabase = obtenerCliente();

  const { data: usuarioInterno, error: errUsuario } = await supabase
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

  const usuarioIdInterno = usuarioInterno.id;

  let preciosResp;
  try {
    preciosResp = await httpClient.post('http://ms-menus:3003/api/menus/precios', { items }, { timeoutMs: 3000, nombre: 'ms-menus:precios' });
  } catch (e) {
    if (e.status >= 400 && e.status < 500) {
      throw new HttpError(e.status, e.message, { detalle: e.detalle });
    }
    throw new HttpError(503, 'No se pudo obtener precios', { causa: e.causa || e.message });
  }

  let verificarResp;
  try {
    verificarResp = await httpClient.post('http://ms-inventario:3004/api/inventario/verificar', { productos: items }, { timeoutMs: 3000, nombre: 'ms-inventario:verificar' });
  } catch (e) {
    if (e.status >= 400 && e.status < 500) {
      throw new HttpError(e.status, e.message, { detalle: e.detalle });
    }
    throw new HttpError(503, 'No se pudo verificar stock', { causa: e.causa || e.message });
  }

  const precios = preciosResp.data || {};

  let total = 0;
  for (const it of items) {
    const pid = String(it.producto_id);
    const p = precios[pid] ?? precios[it.producto_id] ?? 0;
    total += Number(p) * Number(it.cantidad || 0);
  }

  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new HttpError(503, 'No se pudo procesar el pago', { causa: 'SUPABASE_PUBLISHABLE_KEY/ANON_KEY no configuradas' });
  }
  let pedidoResultado;
  let pedidoAdvertencias = [];
  const cafeteriaId = body?.cafeteria_id ?? null;
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

  try {
    for (const it of items) {
      const cant = Number(it.cantidad || 0);
      if (cant <= 0) continue;
      await httpClient.post(
        'http://ms-inventario:3004/api/inventario/movimientos',
        { producto_id: it.producto_id, tipo: 'salida', cantidad: cant, motivo: 'pedido' },
        { timeoutMs: 3000, nombre: 'ms-inventario:movimientos' }
      );
    }
  } catch (e) {
    pedidoAdvertencias.push({ tipo: 'descuento_stock_pendiente', mensaje: 'No se pudo descontar stock vÃ­a movimientos', causa: e.causa || e.message });
  }

  if (pedidoAdvertencias.length > 0 && pedidoResultado) {
    if (typeof pedidoResultado === 'object' && pedidoResultado !== null) {
      pedidoResultado.advertencias = pedidoAdvertencias;
    }
  }

  return { ok: true, pedido: pedidoResultado };
}

async function listarPedidos({ user }) {
  const supabase = obtenerCliente();
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const { data, error } = await supabase.from('pedidos').select('*').limit(100);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function obtenerPedido({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data: pedido, error } = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  return pedido;
}

async function obtenerPedidosPorCafeteria({ user, cafeteriaId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data, error } = await supabase.from('pedidos').select('*').eq('cafeteria_id', cafeteriaId);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function obtenerPedidosPorUsuario({ user, usuarioId }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data, error } = await supabase.from('pedidos').select('*').eq('usuario_id', usuarioId);
  if (error) throw new HttpError(503, error.message);
  return data || [];
}

async function actualizarEstado({ user, id, body }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data, error } = await supabase.from('pedidos').update({ estado: body?.estado }).eq('id', id).select().maybeSingle();
  if (error) throw new HttpError(503, error.message);
  return data;
}

async function obtenerQr({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data: pedido, error } = await supabase.from('pedidos').select('qr_token, id').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  return { qr_token: pedido.qr_token };
}

async function obtenerTokenContingencia({ user, id }) {
  if (!user) throw new HttpError(401, 'Usuario no autenticado');
  const supabase = obtenerCliente();
  const { data: pedido, error } = await supabase.from('pedidos').select('id, usuario_id, cafeteria_id').eq('id', id).maybeSingle();
  if (error) throw new HttpError(503, error.message);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');

  const usuarioIdInterno = await (async () => {
    const { data: ui } = await supabase.from('usuarios').select('id').eq('auth_user_id', user.authUserId).maybeSingle();
    return ui?.id || null;
  })();

  let autorizado = false;
  if (usuarioIdInterno && pedido.usuario_id && usuarioIdInterno === pedido.usuario_id) {
    autorizado = true;
  } else {
    try {
      const { data: cu } = await supabase
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
  const { data, error } = await obtenerCliente().rpc('log_qr_validation', { p_qr_token: body?.qr_token });
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



