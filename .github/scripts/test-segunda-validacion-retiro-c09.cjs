const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbRepo = path.resolve(process.env.COFFEEFAST_DB_REPO || '../db_CoffeeFaster');
const temporal = require(path.join(dbRepo, 'tests/helpers/postgres.cjs'));
const preparar = require(path.join(dbRepo, 'tests/helpers/afiliaciones.cjs'));
const leer = (archivo) => fs.readFileSync(path.join(dbRepo, archivo), 'utf8');
const migracion = (archivo) => leer(`supabase/migrations/${archivo}`);

// El fixture oficial admite el prefijo de su suite de entrega V11.
temporal('v11', async ({ sql }) => {
  preparar(sql);
  sql(migracion('0020_modelar_afiliaciones_y_movimientos.sql'));
  sql(leer('tests/fixtures/afiliaciones.sql'));
  for (const archivo of [
    '0021_autorizar_solicitudes_afiliacion.sql',
    '20261118211348_consulta_saldo_afiliado.sql',
    '20261122193030_habilitar_comision_en_entrega.sql',
  ]) {
    sql(migracion(archivo));
  }

  sql(`GRANT SELECT, UPDATE ON public.pedidos TO service_role;
    UPDATE public.pedidos SET estado = 'listo', qr_usado = false,
      qr_token = 'C09-QR', codigo_retiro_diario = 'C09-TOKEN', entregado_en = NULL WHERE id = 201;
    UPDATE public.campanas SET estado = 'pausada' WHERE id = 1;`);

  const validar = (credencial) => sql(`SET ROLE service_role;
    SELECT count(*) FROM public.confirmar_entrega_pedido(201, 1, '${credencial}');`);
  const observar = () => {
    const pedido = JSON.parse(sql(`SELECT jsonb_build_object('estado', estado,
      'qr_usado', qr_usado, 'entregado_en', entregado_en) FROM public.pedidos WHERE id = 201;`));
    const comisiones = JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id)
      FROM public.movimientos_comision m WHERE pedido_id = 201;`));
    const saldo = JSON.parse(sql(`SET SESSION AUTHORIZATION cf_v04_authenticator;
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
      SELECT row_to_json(s) FROM public.consultar_saldo_afiliado() s;`));
    return { pedido, comisiones, saldo };
  };

  const antes = observar();
  assert.deepEqual(antes.pedido, { estado: 'listo', qr_usado: false, entregado_en: null });
  assert.equal(antes.comisiones.length, 1);
  assert.equal(antes.comisiones[0].estado, 'pendiente');
  assert.equal(antes.comisiones[0].monto_clp, 1000);
  assert.deepEqual(antes.saldo, { pendiente_clp: 1500, disponible_clp: 0, retirado_clp: 0 });

  assert.equal(validar('C09-QR'), '1');
  const entregado = observar();
  assert.equal(entregado.pedido.estado, 'entregado');
  assert.equal(entregado.pedido.qr_usado, true);
  assert.ok(entregado.pedido.entregado_en);
  assert.deepEqual(entregado.comisiones, [{
    ...antes.comisiones[0], estado: 'disponible', actualizado_en: entregado.comisiones[0].actualizado_en,
  }]);
  assert.deepEqual(entregado.saldo, { pendiente_clp: 500, disponible_clp: 1000, retirado_clp: 0 });

  const registrar = (paso, { pedido, comisiones, saldo }) => {
    console.log(JSON.stringify({ paso, pedido, comision: comisiones[0].estado, saldo }));
  };
  registrar('antes', antes);
  registrar('primer QR', entregado);

  for (const [paso, credencial] of [['QR repetido', 'C09-QR'], ['token del mismo pedido', 'C09-TOKEN']]) {
    assert.equal(validar(credencial), '0');
    const despues = observar();
    assert.deepEqual(despues, entregado);
    registrar(paso, despues);
  }
}).catch((error) => {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
});
