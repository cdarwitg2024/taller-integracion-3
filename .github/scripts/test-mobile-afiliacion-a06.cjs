// Solo se invoca desde el runner desechable C05 --a06; no lee .env ni Cloud.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
module.exports = async ({ call, sql, tokens, base, anon, supabaseUrl, dbContainer }) => {
  const password = crypto.randomBytes(24).toString('hex');
  const credentials = { email: `a06-${crypto.randomUUID()}@example.test`, password };
  const alta = await call('/auth/v1/signup', null, 'POST', credentials);
  assert.equal(alta.status, 200);
  const login = await call('/auth/v1/token?grant_type=password', null, 'POST', credentials);
  assert.equal(login.status, 200);
  const token = login.body.access_token;
  assert.ok(token && login.body.user.id);
  sql(`INSERT INTO public.usuarios(id,rol_id,activo,auth_user_id,nombre) VALUES
    (901,4,true,'${login.body.user.id}','Estudiante A06');`);
  const ids = sql(`INSERT INTO public.campanas
    (cafeteria_id,nombre,estado,tasa_descuento,tasa_comision,vigencia_desde,vigencia_hasta,
     confirmada_por_dueno,fecha_confirmacion,usuario_confirma_id,version_confirmada)
    SELECT 7,nombre,'activa',15,10,now()-interval '1 hour',now()+interval '1 day',true,now(),1,'1.0'
    FROM (VALUES ('Pendiente A06'),('Rechazada A06'),('Para aprobar A06')) AS c(nombre) RETURNING id;`)
    .split(/\r?\n/).slice(0, 3).map(Number);
  const recurso = campana => `/api/afiliados/cafeterias/7/campanas/${campana}/solicitudes`;
  const plan = { plan_promocion: 'Plan de promoción desechable A06' };
  const pendiente = await call(recurso(ids[0]), token, 'POST', plan);
  const rechazada = await call(recurso(ids[1]), token, 'POST', plan);
  assert.equal(pendiente.status, 201); assert.equal(rechazada.status, 201);
  const rechazo = await call(`${recurso(ids[1])}/${rechazada.body.id}`, tokens.dueno, 'PATCH', { decision: 'rechazar' });
  assert.equal(rechazo.status, 200);
  // El límite de dos filas fuerza la paginación de C05. Solo la campaña nueva
  // necesita estar vigente en el catálogo de oportunidades de este escenario.
  sql(`UPDATE public.campanas SET estado='pausada' WHERE cafeteria_id=7 AND id<>${ids[2]};`);
  const ajenas = await call('/api/afiliados/mi-perfil', tokens.estudiante);
  const codigoAjeno = ajenas.body.solicitudes.find(s => s.codigo)?.codigo;
  console.log('PREPARADO A06: estudiante nuevo con solicitudes pendiente y rechazada; campaña para solicitar desde Mobile');
  const root = path.resolve(__dirname, '../..');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'app-mobile/node_modules/jest/bin/jest.js'),
      '--config', path.join(root, 'app-mobile/jest.config.js'), '--ci', '--runInBand', '--testTimeout=30000',
      '--runTestsByPath', path.join(root, 'app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js')], {
      cwd: path.join(root, 'app-mobile'), stdio: 'inherit', env: { ...process.env,
        EXPO_PUBLIC_API_URL: base, A06_INTEGRATION_URL: base, A06_STUDENT_TOKEN: token,
        A06_OWNER_TOKEN: tokens.dueno, A09_OTHER_STUDENT_TOKEN: tokens.estudiante,
        A06_SUPABASE_URL: supabaseUrl, A06_ANON_KEY: anon,
        A06_CAMPAIGN_ID: String(ids[2]), A06_DB_CONTAINER: dbContainer, A06_FOREIGN_CODE: codigoAjeno || '',
      },
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Integración A06: salida ${code}`)));
  });
  console.log('PASS A06: pendiente, rechazada, solicitud, aprobación y código desactivado con saldo/historial persistidos');

  const saldo = '/api/afiliados/saldo';
  const retiros = '/api/afiliados/retiros';
  const solicitud = { monto_clp: 1050, clave_idempotencia: 'retiro-c15' };
  async function comprobar(url, sesion, status, body) {
    const method = body ? 'POST' : 'GET';
    const respuesta = await call(url, sesion, method, body);
    console.log('C15', JSON.stringify({ method, url, body, respuesta }));
    assert.equal(respuesta.status, status);
    return respuesta.body;
  }
  assert.deepEqual(await comprobar(saldo, token, 200), {
    pendiente_clp: 0, disponible_clp: 1050, retirado_clp: 450,
  });
  const comprobante = await comprobar(retiros, token, 200, solicitud);
  assert.match(comprobante.referencia, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(comprobante, {
    monto_clp: 1050, estado: 'confirmado', referencia: comprobante.referencia,
    destino: 'Cuenta de prueba CoffeeFast (destino ficticio)', disponible_clp: 0,
  });
  assert.deepEqual(await comprobar(retiros, token, 200, solicitud), comprobante);
  const conflicto = await comprobar(retiros, token, 409, { ...solicitud, monto_clp: 1 });
  assert.equal(conflicto.error, 'conflicto_idempotencia');
  const ajeno = await comprobar(retiros, tokens.estudiante, 422, solicitud);
  assert.equal(ajeno.error, 'saldo_insuficiente');
  await comprobar(retiros, null, 401, solicitud);
  await comprobar(retiros, tokens.dueno, 403, solicitud);
  assert.deepEqual(await comprobar(saldo, token, 200), {
    pendiente_clp: 0, disponible_clp: 0, retirado_clp: 1500,
  });
  assert.equal(sql("SELECT count(*) FROM public.retiros_afiliado WHERE estudiante_id = 901 AND clave_idempotencia = 'retiro-c15'"), '1');
  console.log('PASS C15: comprobante idéntico y una sola fila de retiro');
};
