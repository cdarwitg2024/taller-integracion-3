'use strict';

const assert = require('node:assert/strict');

module.exports = async ({ check, call, sql, tokens }) => {
  const ids = sql(`INSERT INTO public.campanas
    (cafeteria_id, nombre, estado, vigencia_desde, vigencia_hasta, confirmada_por_dueno,
     fecha_confirmacion, usuario_confirma_id, version_confirmada)
    SELECT 7, nombre, estado, now()-interval '1 hour', now()+interval '1 day', true, now(), 1, '1.0'
    FROM (VALUES ('Aprobación', 'activa'), ('Rechazo', 'activa'), ('Pausada', 'pausada')) AS c(nombre, estado)
    RETURNING id;`).split(/\r?\n/).slice(0, 3).map(Number);
  const base = '/api/afiliados/cafeterias/7/campanas';
  const ruta = campana => `${base}/${campana}/solicitudes`;
  const perfil = '/api/afiliados/mi-perfil';
  const plan = { plan_promocion: 'Compartiré un video' };

  async function esperar(status, url, sesion, method, body) {
    const respuesta = await call(url, tokens[sesion], method, body);
    assert.equal(respuesta.status, status, JSON.stringify(respuesta.body));
    return respuesta.body;
  }

  const [campana, paraRechazar, pausada] = ids;
  let pendiente, otra, aprobada;
  await check('C04 descubre las campañas y C05 crea una sola solicitud concurrente', async () => {
    const oportunidades = await esperar(200, base, 'estudiante');
    assert.deepEqual(oportunidades.campanas.map(c => c.id), [campana, paraRechazar]);
    const respuestas = await Promise.all(Array.from({ length: 4 }, () =>
      call(ruta(campana), tokens.estudiante, 'POST', plan)));
    assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 200, 200, 201], JSON.stringify(respuestas));
    pendiente = respuestas.find(r => r.status === 201).body;
    assert.ok(pendiente.id > 0);
    assert.deepEqual(pendiente, { id: pendiente.id, estado: 'pendiente' });
    for (const respuesta of respuestas) assert.deepEqual(respuesta.body, pendiente);
    assert.deepEqual(await esperar(200, perfil, 'estudiante'), {
      solicitudes: [{ ...pendiente, cafeteria_id: 7, campana_id: campana }],
    });
    otra = await esperar(201, ruta(paraRechazar), 'estudiante', 'POST', plan);
    await esperar(409, ruta(pausada), 'estudiante', 'POST', plan);
    await esperar(409, ruta(campana).replace('/7/', '/8/'), 'estudiante', 'POST', plan);
  });

  await check('dueño ajeno y cruce de campaña reciben 403', async () => {
    await esperar(403, ruta(campana), 'otro');
    await esperar(403, ruta(campana).replace('/7/', '/8/'), 'otro');
    for (const decision of ['aprobar', 'rechazar', 'desactivar']) {
      await esperar(403, `${ruta(campana)}/${pendiente.id}`, 'otro', 'PATCH', { decision });
      await esperar(403, `${ruta(paraRechazar)}/${pendiente.id}`, 'dueno', 'PATCH', { decision });
    }
    assert.deepEqual(await esperar(200, ruta(campana), 'dueno'), {
      solicitudes: [{ ...pendiente, solicitante: 'Cuenta', ...plan, enlace_publico: null }],
    });
    await esperar(403, perfil, 'dueno');
    await esperar(403, ruta(campana), 'dueno', 'POST', plan);
  });

  await check('aprobación y reintento conservan ID y código, visibles en el perfil', async () => {
    const url = `${ruta(campana)}/${pendiente.id}`;
    aprobada = await esperar(200, url, 'dueno', 'PATCH', { decision: 'aprobar' });
    assert.equal(aprobada.id, pendiente.id);
    assert.equal(aprobada.estado, 'aprobada');
    assert.equal(aprobada.codigo_activo, true);
    assert.match(aprobada.codigo, /^CF-[0-9A-F]{32}$/);
    assert.deepEqual(await esperar(200, url, 'dueno', 'PATCH', { decision: 'aprobar' }), aprobada);
    const actual = await esperar(200, perfil, 'estudiante');
    assert.deepEqual(actual.solicitudes.find(s => s.id === pendiente.id),
      { ...aprobada, cafeteria_id: 7, campana_id: campana });
  });

  await check('desactivación idempotente conserva el código y el rechazo no genera uno', async () => {
    const url = `${ruta(campana)}/${pendiente.id}`;
    const desactivada = { ...aprobada, codigo_activo: false };
    for (const decision of ['desactivar', 'desactivar', 'aprobar']) {
      assert.deepEqual(await esperar(200, url, 'dueno', 'PATCH', { decision }), desactivada);
    }
    assert.deepEqual(await esperar(200, ruta(campana), 'estudiante', 'POST', plan), desactivada);
    assert.deepEqual(await esperar(200, `${ruta(paraRechazar)}/${otra.id}`, 'dueno', 'PATCH',
      { decision: 'rechazar' }), { id: otra.id, estado: 'rechazada' });
    await esperar(409, `${ruta(paraRechazar)}/${otra.id}`, 'dueno', 'PATCH', { decision: 'aprobar' });
  });

  await check('todas las operaciones exigen un JWT válido', async () => {
    for (const token of [undefined, 'invalido']) {
      for (const [url, metodo, body] of [[perfil, 'GET'], [ruta(campana), 'GET'],
        [ruta(campana), 'POST', plan], [`${ruta(campana)}/${pendiente.id}`, 'PATCH', { decision: 'aprobar' }]]) {
        assert.equal((await call(url, token, metodo, body)).status, 401);
      }
    }
  });
};
