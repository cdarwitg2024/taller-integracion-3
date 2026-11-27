'use strict';

const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

module.exports = async ({ call, sql, tokens }) => {
  const routes = { saldo: '/api/afiliados/saldo', retiros: '/api/afiliados/retiros' };
  const campana = Number(sql(`INSERT INTO public.campanas
    (cafeteria_id,nombre,estado,tasa_descuento,tasa_comision,vigencia_desde,vigencia_hasta,
     confirmada_por_dueno,fecha_confirmacion,usuario_confirma_id,version_confirmada)
    VALUES (7,'Retiros C10','activa',15,10,now()-interval '1 hour',now()+interval '1 day',
      true,now(),1,'1.0') RETURNING id;`).split(/\r?\n/)[0]);
  const recurso = `/api/afiliados/cafeterias/7/campanas/${campana}/solicitudes`;
  const solicitud = await call(recurso, tokens.estudiante, 'POST', { plan_promocion: 'Fixture C10' });
  assert.equal(solicitud.status, 201, JSON.stringify(solicitud.body));
  const aprobacion = await call(`${recurso}/${solicitud.body.id}`, tokens.dueno, 'PATCH', { decision: 'aprobar' });
  assert.equal(aprobacion.status, 200, JSON.stringify(aprobacion.body));
  assert.equal(aprobacion.body.estado, 'aprobada');

  // La pausa conserva abierta la transacción ganadora y permite observar el bloqueo real.
  sql(`INSERT INTO public.pedidos(id,cafeteria_id,estado) VALUES (1010,7,'entregado');
    INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
    VALUES (${solicitud.body.id},1010,'comision',10000,10,1000);
    UPDATE public.movimientos_comision SET estado='disponible' WHERE pedido_id=1010;
    CREATE FUNCTION public.pausar_retiro_c10() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_sleep(5);
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER pausar_retiro_c10 AFTER INSERT ON public.retiros_afiliado
    FOR EACH ROW WHEN (NEW.clave_idempotencia IN ('c10-a','c10-b'))
    EXECUTE FUNCTION public.pausar_retiro_c10();`);
  const inicial = await call(routes.saldo, tokens.estudiante);
  assert.deepEqual(inicial, { status: 200, body: { pendiente_clp: 0, disponible_clp: 1000, retirado_clp: 0 } });
  const solicitudes = [
    { monto_clp: 700, clave_idempotencia: 'c10-a' },
    { monto_clp: 600, clave_idempotencia: 'c10-b' },
  ];
  const pendientes = Promise.allSettled(solicitudes.map(body => call(routes.retiros, tokens.estudiante, 'POST', body)));
  let bloqueo = '';
  try {
    const limite = Date.now() + 4500;
    while (!bloqueo && Date.now() < limite) {
      bloqueo = sql(`SELECT concat(espera.pid, ' espera a ', titular.pid, ' (', espera.wait_event, ')')
        FROM pg_stat_activity espera
        JOIN pg_stat_activity titular ON titular.pid = ANY(pg_blocking_pids(espera.pid))
        WHERE titular.wait_event = 'PgSleep'
          AND titular.query LIKE '%registrar_retiro_simulado%'
          AND espera.query LIKE '%registrar_retiro_simulado%';`);
      if (!bloqueo) await sleep(100);
    }
  } finally {
    await pendientes;
  }
  const respuestas = (await pendientes).map(resultado => {
    if (resultado.status === 'rejected') throw resultado.reason;
    return resultado.value;
  });
  console.log('C10', JSON.stringify({ inicial, solicitudes, bloqueo, respuestas }));
  assert.ok(bloqueo, 'PostgreSQL debe observar una solicitud de retiro esperando a la otra');
  assert.deepEqual(respuestas.map(respuesta => respuesta.status).sort(), [200, 422]);
  const indiceGanador = respuestas.findIndex(respuesta => respuesta.status === 200);
  const ganadora = solicitudes[indiceGanador];
  const comprobante = respuestas[indiceGanador].body;
  assert.equal(respuestas[1 - indiceGanador].body.error, 'saldo_insuficiente');
  assert.equal(comprobante.estado, 'confirmado');
  assert.match(comprobante.referencia, /^[0-9a-f-]{36}$/i);
  assert.equal(comprobante.monto_clp, ganadora.monto_clp);
  assert.ok(comprobante.monto_clp <= inicial.body.disponible_clp);
  const restante = inicial.body.disponible_clp - comprobante.monto_clp;
  assert.equal(comprobante.disponible_clp, restante);

  const final = await call(routes.saldo, tokens.estudiante);
  const filas = JSON.parse(sql(`SELECT coalesce(json_agg(r), '[]'::json)
    FROM (SELECT clave_idempotencia, monto_clp, referencia, disponible_posterior_clp
      FROM public.retiros_afiliado WHERE estudiante_id = 6) r;`));
  console.log('C10', JSON.stringify({ final, filas }));
  assert.deepEqual(final, {
    status: 200, body: { pendiente_clp: 0, disponible_clp: restante, retirado_clp: comprobante.monto_clp },
  });
  assert.deepEqual(filas, [{
    clave_idempotencia: ganadora.clave_idempotencia, monto_clp: comprobante.monto_clp,
    referencia: comprobante.referencia, disponible_posterior_clp: restante,
  }]);
};
