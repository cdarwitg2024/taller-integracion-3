'use strict';

/**
 * Prueba reproducible de database/fixes/limitar_beneficio_por_comprador_y_codigo.sql
 * sobre las migraciones reales V07, V08 y V09 de db_CoffeeFaster.
 *
 * Reutiliza el helper y los fixtures de db_CoffeeFaster que usa CI para crear
 * una base temporal. Requiere Docker (TEST_POSTGRES_CONTAINER) o un PostgreSQL
 * local desechable (PGHOST + psql).
 *
 * Uso desde la raíz de taller-integracion-3:
 *   TEST_POSTGRES_CONTAINER=cf-test-postgres \
 *   DB_COFFEEFASTER_DIR=.test-bd \
 *   node database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const raizDb = path.resolve(
  process.env.DB_COFFEEFASTER_DIR || path.join(__dirname, '../../.test-bd')
);
const temporal = require(path.join(raizDb, 'tests/helpers/postgres.cjs'));
const prepararAfiliaciones = require(path.join(raizDb, 'tests/helpers/afiliaciones.cjs'));
const leerMigracion = (nombre) =>
  fs.readFileSync(path.join(raizDb, 'supabase/migrations', nombre), 'utf8');
const migracionPr = fs.readFileSync(
  path.join(__dirname, '../fixes/limitar_beneficio_por_comprador_y_codigo.sql'),
  'utf8'
);

const sesion = (usuario) => `SET SESSION AUTHORIZATION cf_v04_authenticator; SET ROLE authenticated;
  SET request.jwt.claim.sub='00000000-0000-0000-0000-${String(usuario).padStart(12, '0')}';`;
const items = '[{"producto_id":401,"cantidad":1}]';
const pagar = (clave, total = 850, codigo = "'CAFE-11'", carrito = items, cafeteria = 1) =>
  `SELECT public.procesar_pago(${cafeteria},'${carrito}'::jsonb,'12:30-12:45',${codigo},${total},'${clave}');`;
const cotizar = (codigo, cafeteria = 1) =>
  `SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(${cafeteria},'${items}',${codigo}) c;`;

temporal('v07', async ({ sql, sqlAsync }) => {
  prepararAfiliaciones(sql);
  sql(leerMigracion('0006_funciones_y_triggers_wallet.sql'));
  sql(leerMigracion('0020_modelar_afiliaciones_y_movimientos.sql'));
  sql(fs.readFileSync(path.join(raizDb, 'tests/fixtures/afiliaciones.sql'), 'utf8'));
  for (const nombre of [
    '0021_autorizar_solicitudes_afiliacion.sql',
    '0022_s3_t5_crear_tabla_promociones.sql',
    '20261117175958_cotizar_carrito_afiliado.sql',
    '20261120204414_validar_primera_compra.sql',
    '20261120210809_registrar_afiliacion_pago.sql',
    '20261121200029_revertir_comision_cancelacion.sql'
  ]) {
    sql(leerMigracion(nombre));
  }

  // Segundo código válido para el mismo comprador. La carrera usa CAFE-11
  // con el estudiante 13, que no es el titular del código.
  sql(`
    INSERT INTO public.campanas(
      id, cafeteria_id, nombre, estado, version_condiciones, tasa_comision,
      vigencia_desde, vigencia_hasta)
    OVERRIDING SYSTEM VALUE VALUES
      (3, 1, 'Campaña C — segundo código', 'activa', '1.0', 10,
       now() - interval '1 day', now() + interval '10 days');
    INSERT INTO public.solicitudes_afiliacion(
      id, estudiante_id, campana_id, plan_promocion, estado, codigo,
      codigo_activo, resuelta_por, resuelta_en)
    OVERRIDING SYSTEM VALUE VALUES
      (106, 11, 3, 'Plan aprobado C', 'aprobada', 'ALTER-11', true, 1, now());
    UPDATE public.campanas SET tasa_descuento=15, tasa_descuento_oferta=5,
      version_condiciones='v07';
    UPDATE public.campanas SET confirmada_por_dueno=true, fecha_confirmacion=now(),
      usuario_confirma_id=1, version_confirmada=version_condiciones;
    UPDATE public.wallets SET saldo_actual=100000;
    INSERT INTO public.metodos_pago(codigo, nombre) VALUES('WALLET', 'Wallet');
    INSERT INTO public.productos(id, cafeteria_id, nombre, precio, stock)
      VALUES(401, 1, 'Producto de prueba', 1000, 100);
  `);

  // La migración del PR se aplica después de V07/V08/V09.
  sql(migracionPr);

  const compra = (usuario, clave, codigo, total = 850) =>
    JSON.parse(sql(sesion(usuario) + pagar(clave, total, codigo)));
  const cotizacion = (codigo) => JSON.parse(sql(sesion(11) + cotizar(codigo)));

  // 1. Una compra previa sin código no consume el beneficio de un código nuevo.
  // El fixture deja el pedido 203 de usuario 11 en la cafetería 1, pagado y sin
  // movimiento de comisión. V07 lo bloqueaba; la migración debe ignorarlo.
  assert.equal(sql('SELECT afiliados_privado.tiene_uso_de_codigo(11,104)'), 'f');
  assert.equal(
    sql(`SELECT count(*) FROM pedidos WHERE usuario_id=11 AND cafeteria_id=1
      AND pago_estado='pagado' AND estado <> 'cancelado'`),
    '1'
  );
  const primera = cotizacion("'CAFE-11'");
  assert.equal(primera.motivo, null);
  assert.equal(primera.total, 850);
  const saldoComprador = () => Number(sql('SELECT saldo_actual FROM wallets WHERE usuario_id=11'));
  const saldoInicial = saldoComprador();
  const confirmarCompra1 = () => compra(11, 'c12-previo-sin-codigo', "'CAFE-11'");
  const compra1 = confirmarCompra1();
  assert.equal(compra1.ok, true);
  assert.equal(compra1.total_pagado, 850);
  assert.equal(compra1.descuento_afiliado, 150);
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_wallet
      WHERE pedido_id=${compra1.pedido_id} AND tipo='compra' AND monto=-850`),
    '1'
  );

  const saldoTrasCompra = saldoComprador();
  assert.equal(saldoTrasCompra, saldoInicial - 850);
  const repetirCompra = confirmarCompra1();
  assert.equal(repetirCompra.ok, true);
  assert.equal(repetirCompra.pedido_id, compra1.pedido_id);
  assert.equal(saldoComprador(), saldoTrasCompra);
  assert.equal(sql(`SELECT count(*) FROM movimientos_wallet
    WHERE pedido_id=${compra1.pedido_id} AND tipo='compra'`), '1');
  console.log(`D15 compra y reintento: pedido #${compra1.pedido_id}, debito -850, saldo ${saldoInicial} -> ${saldoTrasCompra}; mismo ID y saldo al repetir.`);

  // D14: la segunda compra del mismo usuario y cafetería se confirma a precio completo.
  const compraD14 = compra(10, 'd14-primera', "'CAFE-11'");
  assert.equal(compraD14.ok, true);
  assert.equal(compraD14.total_pagado, 850);
  assert.equal(compraD14.descuento_afiliado, 150);
  assert.equal(sql(`SELECT monto FROM movimientos_wallet
    WHERE pedido_id=${compraD14.pedido_id} AND tipo='compra'`), '-850');
  const recurrente = JSON.parse(sql(sesion(10) + cotizar("'CAFE-11'")));
  assert.equal(recurrente.motivo, 'beneficio_usado');
  assert.equal(recurrente.total, 1000);
  const compraRecurrente = compra(10, 'd14-recurrente', 'NULL', recurrente.total);
  assert.equal(compraRecurrente.ok, true);
  assert.notEqual(compraRecurrente.pedido_id, compraD14.pedido_id);
  assert.equal(compraRecurrente.total_pagado, 1000);
  assert.equal(compraRecurrente.descuento_afiliado, 0);
  assert.equal(sql(`SELECT count(*) FROM pedidos
    WHERE usuario_id=10 AND cafeteria_id=1 AND id IN (${compraD14.pedido_id},${compraRecurrente.pedido_id})`), '2');
  assert.equal(sql(`SELECT monto FROM movimientos_wallet
    WHERE pedido_id=${compraRecurrente.pedido_id} AND tipo='compra'`), '-1000');
  assert.equal(sql(`SELECT monto_clp FROM movimientos_comision
    WHERE pedido_id=${compraD14.pedido_id} AND tipo='comision'`), '85');
  assert.equal(sql(`SELECT count(*) FROM movimientos_comision
    WHERE pedido_id=${compraRecurrente.pedido_id}`), '0');
  console.log(`D14 OK: estudiante 10, cafetería 1. Pedido #${compraD14.pedido_id}: total 850, descuento 150, comisión 85. Pedido #${compraRecurrente.pedido_id}: total 1000, descuento 0, comisión 0.`);

  // 2. El mismo comprador puede usar otro código de la misma cafetería.
  const segundaCotizacion = cotizacion("'ALTER-11'");
  assert.equal(segundaCotizacion.motivo, null);
  assert.equal(segundaCotizacion.total, 850);
  const compra2 = compra(11, 'c12-segundo-codigo', "'ALTER-11'");
  assert.equal(compra2.ok, true);
  assert.equal(compra2.total_pagado, 850);
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_comision
      WHERE pedido_id IN (${compra1.pedido_id},${compra2.pedido_id})
        AND estado <> 'revertida'`),
    '2'
  );
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_wallet
      WHERE pedido_id IN (${compra1.pedido_id},${compra2.pedido_id})
        AND tipo='compra' AND monto=-850`),
    '2'
  );

  // 3. Dos compras simultáneas del mismo comprador y código, con claves de
  // idempotencia distintas, dejan un solo débito y una sola comisión.
  assert.equal(sql('SELECT count(*) FROM pedidos WHERE usuario_id=13 AND cafeteria_id=1'), '0');
  const primeraTransaccion = sqlAsync(
    `SET application_name='c11_primera';
     BEGIN; ${sesion(13)} ${pagar('c11-concurrente-a')}
     SELECT pg_sleep(8); COMMIT;`
  );
  const finPrimera = primeraTransaccion.then((valor) => ({ valor }), (error) => ({ error }));
  let primeraEnCurso = false;
  for (let intento = 0; intento < 150; intento += 1) {
    if (sql(`SELECT EXISTS(SELECT FROM pg_stat_activity
        WHERE application_name='c11_primera' AND wait_event='PgSleep')`) === 't') {
      primeraEnCurso = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(primeraEnCurso, 'La primera compra debe mantener el bloqueo mientras duerme');

  const segundaTransaccion = sqlAsync(
    `SET application_name='c11_segunda'; ${sesion(13)}
     ${pagar('c11-concurrente-b')}`
  );
  const finSegunda = segundaTransaccion.then((valor) => ({ valor }), (error) => ({ error }));
  let segundaEsperando = false;
  for (let intento = 0; intento < 150; intento += 1) {
    if (sql(`SELECT EXISTS(SELECT FROM pg_stat_activity a, pg_stat_activity b
        WHERE a.application_name='c11_primera' AND b.application_name='c11_segunda'
          AND a.pid = ANY(pg_blocking_pids(b.pid)))`) === 't') {
      segundaEsperando = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(segundaEsperando, 'La segunda sesión debe esperar a la primera transacción');

  const [resultadoA, resultadoB] = await Promise.all([finPrimera, finSegunda]);
  if (resultadoA.error) throw resultadoA.error;
  if (resultadoB.error) throw resultadoB.error;
  const concurrenteA = JSON.parse(resultadoA.valor.split('\n')[0]);
  const concurrenteB = JSON.parse(resultadoB.valor);
  assert.equal(concurrenteA.ok, true);
  assert.equal(concurrenteA.total_pagado, 850);
  assert.equal(concurrenteA.descuento_afiliado, 150);
  assert.equal(concurrenteB.error, 'precio_actualizado');
  assert.equal(concurrenteB.motivo, 'beneficio_usado');
  assert.equal(concurrenteB.cobrado, false);
  assert.equal(concurrenteB.total_actualizado, 1000);
  assert.equal(concurrenteB.descuento_afiliado, 0);
  assert.equal(sql('SELECT count(*) FROM pedidos WHERE usuario_id=13'), '1');
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_wallet w
      JOIN pedidos p ON p.id=w.pedido_id
      WHERE p.usuario_id=13 AND w.tipo='compra'`),
    '1'
  );
  assert.equal(sql(`SELECT monto FROM movimientos_wallet
    WHERE pedido_id=${concurrenteA.pedido_id} AND tipo='compra'`), '-850');
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_comision m
      JOIN pedidos p ON p.id=m.pedido_id
      WHERE p.usuario_id=13 AND p.cafeteria_id=1 AND m.pedido_id=${concurrenteA.pedido_id}
        AND m.afiliacion_id=104 AND m.tipo='comision' AND m.estado='pendiente' AND m.monto_clp=85`),
    '1'
  );
  assert.equal(sql(`SELECT count(*) FROM movimientos_comision m
    JOIN pedidos p ON p.id=m.pedido_id WHERE p.usuario_id=13`), '1');
  console.log(`C11: c11-concurrente-a pagó 850 CLP (descuento 150, comisión pendiente 85, pedido ${concurrenteA.pedido_id}).`);
  console.log('C11: c11-concurrente-b esperó el bloqueo y recibió beneficio_usado, total 1000 CLP, sin cobro.');

  // 4. Un reembolso completo antes de la entrega vuelve a habilitar el código
  // mientras siga vigente. V09 revierte la comisión y el pedido queda cancelado.
  const saldoAntesDeCancelar = saldoComprador();
  const cancelarCompra1 = () => JSON.parse(
    sql(sesion(11) + `SELECT public.cancelar_pedido(${compra1.pedido_id});`)
  );
  const cancelacion = cancelarCompra1();
  assert.equal(cancelacion.ok, true);
  assert.equal(cancelacion.monto_reembolsado, 850);
  const saldoTrasCancelar = saldoComprador();
  assert.equal(saldoTrasCancelar, saldoAntesDeCancelar + 850);
  const repetirCancelacion = cancelarCompra1();
  assert.equal(repetirCancelacion.ok, false);
  assert.equal(repetirCancelacion.motivo, 'ya_cancelado');
  assert.equal(saldoComprador(), saldoTrasCancelar);
  assert.equal(sql(`SELECT estado FROM pedidos WHERE id=${compra1.pedido_id}`), 'cancelado');
  assert.equal(sql(`SELECT monto FROM movimientos_wallet
    WHERE pedido_id=${compra1.pedido_id} AND tipo='reembolso'`), '850');
  console.log(`D15 cancelacion y reintento: pedido #${compra1.pedido_id} cancelado, reembolso +850, saldo ${saldoAntesDeCancelar} -> ${saldoTrasCancelar}; ya_cancelado y mismo saldo al repetir.`);
  assert.equal(
    sql(`SELECT count(*) FROM movimientos_comision
      WHERE pedido_id=${compra1.pedido_id} AND tipo='comision' AND estado='revertida'`),
    '1'
  );
  const reCotizacion = cotizacion("'CAFE-11'");
  assert.equal(reCotizacion.motivo, null);
  assert.equal(reCotizacion.total, 850);
  const recompra = compra(11, 'c12-tras-reembolso', "'CAFE-11'");
  assert.equal(recompra.ok, true);
  assert.equal(recompra.total_pagado, 850);

  console.log(
    'APROBADO: compra previa sin código, dos códigos por comprador, ' +
    'concurrencia con un solo débito y recompra tras reembolso total.'
  );
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
