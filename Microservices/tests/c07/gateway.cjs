'use strict';

const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

const gateway = process.env.C07_GATEWAY_URL || 'http://gateway';
const fixture = process.env.C07_FIXTURE_URL || 'http://supabase-fixture:54321';
const carrito = { cafeteria_id: 7, items: [{ producto_id: 41, cantidad: 1 }] };
const afiliado = { ...carrito, codigo: 'DIEGO-PROMO1' };
const cotizaciones = '/api/afiliados/cotizaciones';
const pedidos = '/api/pedidos';

async function post(path, body, status, clave, token = 'c07-comprador') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (clave) headers['Idempotency-Key'] = clave;
  const response = await fetch(gateway + path, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, status, `${path} — ${JSON.stringify(payload)}`);
  return payload;
}

async function leerFixture(path, method = 'GET') {
  const response = await fetch(fixture + path, { method });
  assert.equal(response.status, 200);
  return response.json();
}

async function esperarGateway() {
  for (let intento = 0; intento < 60; intento++) {
    try {
      const response = await fetch(gateway + cotizaciones, { method: 'POST' });
      const pedido = await fetch(gateway + pedidos, { method: 'POST' });
      if (response.status === 401 && pedido.status === 401) return;
    } catch (error) {
      if (error.name !== 'TypeError') throw error;
    }
    await delay(1000);
  }
  throw new Error('El gateway o los servicios no arrancaron');
}

async function main() {
  await esperarGateway();
  const inicial = await leerFixture('/estado');
  assert.equal(inicial.saldo, 50000);
  assert.equal(inicial.pedidos.length, 0);

  await post(cotizaciones, afiliado, 401, undefined, '');
  await post(pedidos, afiliado, 401, undefined, 'sesion-invalida');
  const cotizacion = await post(cotizaciones, afiliado, 200);
  assert.deepEqual(cotizacion, { subtotal: 10000, descuento_afiliado: 1500, total: 8500 });
  await post(cotizaciones, { ...carrito, codigo: 'RPC-SIN-ACCESO' }, 403);
  await post(cotizaciones, { ...carrito, codigo: 'RPC-MALFORMADA' }, 503);
  assert.deepEqual(await post(cotizaciones, { ...carrito, codigo: 'CAMPANA-FUTURA' }, 422), {
    error: 'campana_no_iniciada'
  });
  assert.deepEqual(await leerFixture('/estado'), inicial);

  const compra = { ...afiliado, franja_retiro: '12:30-12:45', total_aceptado: cotizacion.total };
  await post(pedidos, compra, 400);
  await post(pedidos, afiliado, 400, 'c07-incompleta');
  await post(pedidos, { ...compra, cafeteria_id: 8 }, 400, 'c07-cafeteria-ajena');
  await leerFixture('/comprador', 'POST');
  await post(pedidos, compra, 403, 'c07-comprador-inactivo');
  await leerFixture('/comprador', 'POST');
  assert.deepEqual(await post(pedidos, compra, 422, 'c07-saldo-insuficiente'), {
    error: 'saldo_insuficiente', cobrado: false
  });
  assert.deepEqual(await post(pedidos, compra, 409, 'c07-stock-insuficiente'), {
    error: 'stock_insuficiente', cobrado: false
  });
  assert.deepEqual(await post(pedidos, compra, 422, 'c07-sin-wallet'), {
    error: 'sin_wallet', cobrado: false
  });
  const compraConPrecioPorLinea = {
    ...compra, items: [{ ...compra.items[0], precio_esperado: 9000 }]
  };
  assert.deepEqual(await post(pedidos, compraConPrecioPorLinea, 409, 'c07-precio-linea'), {
    error: 'precio_actualizado', motivo: 'precio_actualizado', total_aceptado: 8500,
    total_actualizado: 8500, cobrado: false
  });
  await post(pedidos, compra, 503, 'c07-rpc-malformada');
  assert.deepEqual(await leerFixture('/estado'), inicial);
  await leerFixture('/pausar', 'POST');
  const rechazada = await post(cotizaciones, afiliado, 422);
  assert.equal(rechazada.error, 'campana_pausada');
  assert.deepEqual(await post(pedidos, compra, 409, 'c07-cambio'), {
    error: 'precio_actualizado', motivo: 'campana_pausada', total_aceptado: 8500,
    total_actualizado: 10000, descuento_afiliado: 0, cobrado: false
  });
  assert.deepEqual(await leerFixture('/estado'), inicial);
  await leerFixture('/pausar', 'POST');

  await leerFixture('/fallar', 'POST');
  await post(pedidos, compra, 503, 'c07-afiliada');
  assert.deepEqual(await leerFixture('/estado'), inicial);
  await leerFixture('/fallar', 'POST');

  const pagada = await post(pedidos, compra, 201, 'c07-afiliada');
  assert.deepEqual(pagada, {
    pedido_id: 501, estado: 'pagado', total_pagado: cotizacion.total,
    descuento_afiliado: cotizacion.descuento_afiliado
  });
  assert.deepEqual(await post(pedidos, compra, 201, 'c07-afiliada'), pagada);
  const trasAfiliada = await leerFixture('/estado');
  assert.equal(trasAfiliada.saldo, 41500);
  const pedidoPagado = { ...pagada, ok: true, estado: 'pendiente', pago_estado: 'pagado' };
  assert.deepEqual(trasAfiliada.pedidos, [pedidoPagado]);
  assert.deepEqual(trasAfiliada.comisiones, [{ pedido_id: pagada.pedido_id, monto: 850 }]);

  const normal = { ...carrito, franja_retiro: compra.franja_retiro, total_aceptado: 10000 };
  const original = await post(pedidos, normal, 201, 'c07-normal');
  assert.equal(original.total_pagado, 10000);
  assert.deepEqual(await post(pedidos, normal, 201, 'c07-normal'), original);
  assert.deepEqual(await post(pedidos, { ...normal, total_aceptado: 9999 }, 409, 'c07-normal'), {
    error: 'clave_reintento_en_conflicto'
  });
  const trasNormal = await leerFixture('/estado');
  assert.equal(trasNormal.saldo, 31500);
  assert.deepEqual(trasNormal.pedidos, [
    pedidoPagado,
    { ...original, ok: true, estado: 'pendiente', pago_estado: 'pagado' }
  ]);
  assert.deepEqual(trasNormal.comisiones, trasAfiliada.comisiones);

  // La cotización afiliada se obtuvo antes de consumir el beneficio en C07.
  assert.equal(cotizacion.descuento_afiliado, 1500);
  const sinCodigo = await post(cotizaciones, carrito, 200);
  const quitado = await post(pedidos, { ...normal, total_aceptado: sinCodigo.total }, 201, 'd13-codigo-quitado');
  assert.equal(quitado.total_pagado, sinCodigo.total);
  assert.equal(quitado.descuento_afiliado, 0);
  assert.equal(original.descuento_afiliado, 0);
  assert.notEqual(quitado.pedido_id, original.pedido_id);
  const trasQuitar = await leerFixture('/estado');
  assert.equal(trasQuitar.saldo, trasNormal.saldo - sinCodigo.total);
  assert.deepEqual(trasQuitar.pedidos, [
    ...trasNormal.pedidos,
    { ...quitado, ok: true, estado: 'pendiente', pago_estado: 'pagado' }
  ]);
  assert.deepEqual(trasQuitar.comisiones, trasNormal.comisiones);
  console.log(`D13 OK: pedidos ${original.pedido_id} y ${quitado.pedido_id} sin comisión, total ${sinCodigo.total} cada uno.`);

  const legacy = await post(pedidos, { ...afiliado, franja_retiro: compra.franja_retiro }, 201);
  assert.equal(legacy.ok, true);
  assert.equal(legacy.pedido.total, 10000);
  assert.equal((await leerFixture('/estado')).saldo, 11500);
  console.log(`C07 OK: pedidos ${pagada.pedido_id} y ${original.pedido_id} conservados al reintentar.`);
  console.log('Reconfirmación y fallo simulado: saldo, pedidos y comisiones sin cambios.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
