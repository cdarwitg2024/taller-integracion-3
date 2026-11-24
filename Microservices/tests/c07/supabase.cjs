'use strict';

const { createServer } = require('node:http');

// Doble desechable de Auth, PostgREST y precios legacy para la prueba HTTP.
const comprador = '793e98b0-6882-4c3b-9794-60b70c125a31';
let estado = { saldo: 50000, pedidos: [], comisiones: [], intentos: {} };
let pausada = false;
let fallar = false;
let compradorActivo = true;

function cotizar(codigo) {
  const motivo = codigo === null ? 'sin_codigo'
    : codigo !== 'DIEGO-PROMO1' ? 'codigo_invalido'
    : pausada ? 'campana_pausada'
    : estado.comisiones.length ? 'beneficio_usado' : null;
  const descuento = motivo === null ? 1500 : 0;
  return { motivo, subtotal: 10000, descuento_afiliado: descuento, total: 10000 - descuento };
}

const server = createServer(async (req, res) => {
  function json(status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  const path = new URL(req.url, 'http://fixture').pathname;
  if (path === '/estado') return json(200, estado);
  if (path === '/pausar' && req.method === 'POST') {
    pausada = !pausada;
    return json(200, { pausada });
  }
  if (path === '/fallar' && req.method === 'POST') {
    fallar = !fallar;
    return json(200, { fallar });
  }
  if (path === '/comprador' && req.method === 'POST') {
    compradorActivo = !compradorActivo;
    return json(200, { activo: compradorActivo });
  }

  if (path === '/api/menus/precios') {
    return json(200, { data: [{ id: 41, precio: 10000, activo: true, cafeteria_id: 7 }] });
  }
  if (req.headers.authorization !== 'Bearer c07-comprador' ||
      req.headers.apikey !== 'c07-fixture-key') {
    return json(401, { code: 'PGRST301', message: 'Sesion invalida' });
  }
  if (path === '/auth/v1/user') {
    return json(200, { id: comprador, role: 'authenticated', user_metadata: {} });
  }
  if (path === '/rest/v1/usuarios') return json(200, [{ id: 15, activo: compradorActivo }]);
  if (!['/rest/v1/rpc/cotizar_carrito_afiliado', '/rest/v1/rpc/procesar_pago'].includes(path)) {
    return json(404, { message: 'Ruta desconocida' });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const args = JSON.parse(Buffer.concat(chunks));
  if (args.p_cafeteria_id !== 7 || args.p_items?.length !== 1 ||
      args.p_items[0].producto_id !== 41 || args.p_items[0].cantidad !== 1) {
    return json(400, { code: '22023', message: 'Carrito invalido' });
  }
  const cotizacion = cotizar(args.p_codigo ?? null);
  if (path.endsWith('/cotizar_carrito_afiliado')) {
    if (args.p_codigo === 'RPC-SIN-ACCESO') return json(403, { code: '42501' });
    if (args.p_codigo === 'RPC-MALFORMADA') return json(200, [{ motivo: null }]);
    if (args.p_codigo === 'CAMPANA-FUTURA') {
      return json(200, [{ ...cotizacion, motivo: 'campana_no_iniciada' }]);
    }
    return json(200, [{ ...cotizacion, comision: cotizacion.motivo ? 0 : 850 }]);
  }

  const clave = args.p_clave_idempotencia;
  if (clave === 'c07-saldo-insuficiente') return json(200, { error: 'saldo_insuficiente' });
  if (clave === 'c07-rpc-malformada') return json(200, { pedido_id: 0 });
  const huella = JSON.stringify(args);
  if (clave && Object.hasOwn(estado.intentos, clave)) {
    const intento = estado.intentos[clave];
    return json(200, intento.huella === huella
      ? intento.pedido : { error: 'clave_reintento_en_conflicto' });
  }
  if (clave && cotizacion.total !== args.p_total_aceptado) {
    return json(200, {
      error: 'precio_actualizado',
      motivo: cotizacion.motivo || 'precio_cambiado',
      total_actualizado: cotizacion.total,
      descuento_afiliado: cotizacion.descuento_afiliado
    });
  }
  if (estado.saldo < cotizacion.total) return json(200, { error: 'saldo_insuficiente' });

  const borrador = structuredClone(estado);
  const pedido = {
    pedido_id: 501 + borrador.pedidos.length,
    estado: 'pagado',
    total_pagado: cotizacion.total,
    descuento_afiliado: cotizacion.descuento_afiliado
  };
  borrador.pedidos.push(pedido);
  borrador.saldo -= pedido.total_pagado;
  if (fallar) return json(500, { code: 'P0001', message: 'fallo_controlado_c07' });
  if (cotizacion.motivo === null) borrador.comisiones.push({ pedido_id: pedido.pedido_id, monto: 850 });
  if (clave) Object.defineProperty(borrador.intentos, clave, {
    value: { huella, pedido }, enumerable: true
  });
  estado = borrador;
  if (clave) return json(200, pedido);
  return json(200, {
    ok: true, pedido_id: pedido.pedido_id, total: pedido.total_pagado,
    saldo_restante: estado.saldo, estado: 'pendiente', pago_estado: 'pagado'
  });
});

server.listen(Number(process.env.C07_FIXTURE_PORT || 54321));
