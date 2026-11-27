'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

module.exports = async ({ call, sql, tokens, check }) => {
  const propia = tokens.estudiante;
  const ajena = tokens.estudianteAjeno;
  const qr = randomUUID();
  const contingencia = randomUUID();
  const pedido = '/api/pedidos/1013';
  const perfil = '/api/afiliados/mi-perfil';
  const saldo = '/api/afiliados/saldo';
  const retiros = '/api/afiliados/retiros';
  const campana = Number(sql(`INSERT INTO public.campanas
    (cafeteria_id,nombre,estado,tasa_descuento,tasa_comision,vigencia_desde,vigencia_hasta,
     confirmada_por_dueno,fecha_confirmacion,usuario_confirma_id,version_confirmada)
    VALUES (7,'Aislamiento C13','activa',15,10,now()-interval '1 hour',now()+interval '1 day',
      true,now(),1,'1.0') RETURNING id;`).split(/\r?\n/)[0]);
  const solicitudes = `/api/afiliados/cafeterias/7/campanas/${campana}/solicitudes`;
  const alta = await call(solicitudes, propia, 'POST', { plan_promocion: 'Fixture C13' });
  assert.equal(alta.status, 201);
  const aprobacion = await call(`${solicitudes}/${alta.body.id}`, tokens.dueno, 'PATCH', { decision: 'aprobar' });
  assert.equal(aprobacion.status, 200);
  const codigo = aprobacion.body.codigo;
  assert.ok(typeof codigo === 'string' && codigo.length > 0, 'La aprobación asigna un código');
  sql(`INSERT INTO public.pedidos(id,cafeteria_id,estado,usuario_id,qr_token,codigo_retiro_diario)
      VALUES (1013,7,'listo',6,'${qr}','${contingencia}');
    INSERT INTO public.pedidos(id,cafeteria_id,estado,usuario_id) VALUES (1014,7,'entregado',6);
    INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
      VALUES (${Number(alta.body.id)},1014,'comision',10000,10,1000);
    UPDATE public.movimientos_comision SET estado='disponible' WHERE pedido_id=1014;`);

  // Registrar solo estados y etiquetas. Incluso si falla una aserción, no mostrar valores privados.
  function sinDatosPrivados(respuesta, ...valores) {
    const cuerpo = JSON.stringify(respuesta.body);
    assert.ok(valores.every(valor => !cuerpo.includes(valor)), 'La respuesta contiene un valor privado');
  }

  await check('C13 QR y contingencia: titular 200, estudiante ajeno 404 y 403', async () => {
    for (const [ruta, campo, valor, rechazo] of [
      ['qr', 'qr_token', qr, 404], ['token-contingencia', 'token', contingencia, 403],
    ]) {
      const lecturaPropia = await call(`${pedido}/${ruta}`, propia);
      assert.equal(lecturaPropia.status, 200);
      assert.ok(lecturaPropia.body[campo] === valor, 'La credencial propia coincide con la persistida');
      const lecturaAjena = await call(`${pedido}/${ruta}`, ajena);
      assert.equal(lecturaAjena.status, rechazo);
      sinDatosPrivados(lecturaAjena, qr, contingencia);
    }
  });

  await check('C13 perfil V05: titular ve su código, perfil ajeno vacío', async () => {
    const lecturaPropia = await call(perfil, propia);
    assert.equal(lecturaPropia.status, 200);
    assert.ok(lecturaPropia.body.solicitudes.some(item => item.id === alta.body.id && item.codigo === codigo),
      'El perfil propio debe contener su código');
    const lecturaAjena = await call(perfil, ajena);
    assert.equal(lecturaAjena.status, 200);
    sinDatosPrivados(lecturaAjena, codigo);
    assert.ok(lecturaAjena.body.solicitudes.length === 0, 'El perfil ajeno no tiene solicitudes propias');
  });

  const saldoEsperado = (disponible_clp, retirado_clp) => ({
    status: 200, body: { pendiente_clp: 0, disponible_clp, retirado_clp },
  });
  await check('C13 saldo V12: titular 1000, ajeno 0 y selector de titular rechazado con 400', async () => {
    assert.deepEqual(await call(saldo, propia), saldoEsperado(1000, 0));
    assert.deepEqual(await call(saldo, ajena), saldoEsperado(0, 0));
    const rechazo = await call(`${saldo}?estudiante_id=6`, ajena);
    assert.equal(rechazo.status, 400);
    assert.ok(!Object.hasOwn(rechazo.body, 'disponible_clp'), 'La respuesta de rechazo omite el saldo');
  });

  await check('C13 retiro V14: titular 200, otra cuenta 422 y selector rechazado con 400', async () => {
    const solicitud = { monto_clp: 400, clave_idempotencia: randomUUID() };
    const retiro = await call(retiros, propia, 'POST', solicitud);
    assert.equal(retiro.status, 200);
    assert.equal(retiro.body.monto_clp, 400);
    assert.equal(retiro.body.estado, 'confirmado');
    const referencia = retiro.body.referencia;
    assert.ok(typeof referencia === 'string' && referencia.length > 0, 'El retiro tiene referencia');
    const rechazo = await call(retiros, ajena, 'POST', solicitud);
    assert.equal(rechazo.status, 422);
    assert.equal(rechazo.body.error, 'saldo_insuficiente');
    sinDatosPrivados(rechazo, referencia);
    const selector = await call(retiros, ajena, 'POST', { ...solicitud, estudiante_id: 6 });
    assert.equal(selector.status, 400);
    sinDatosPrivados(selector, referencia);

    const historial = `/rest/v1/retiros_afiliado?select=referencia,monto_clp&referencia=eq.${referencia}`;
    const propio = await call(historial, propia);
    assert.equal(propio.status, 200);
    assert.ok(propio.body.length === 1 && propio.body[0].referencia === referencia && propio.body[0].monto_clp === 400,
      'El historial propio devuelve el comprobante confirmado');
    const ajeno = await call(historial, ajena);
    assert.equal(ajeno.status, 200);
    assert.ok(ajeno.body.length === 0, 'RLS filtra el comprobante para la otra cuenta');
    assert.deepEqual(await call(saldo, propia), saldoEsperado(600, 400));
    assert.deepEqual(await call(saldo, ajena), saldoEsperado(0, 0));
    assert.equal(sql('SELECT count(*) FROM public.retiros_afiliado WHERE estudiante_id = 6 AND monto_clp = 400;'), '1');
    assert.equal(sql('SELECT count(*) FROM public.retiros_afiliado;'), '1');
  });
};
