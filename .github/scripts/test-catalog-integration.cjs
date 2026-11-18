// API Express real -> supabase-js real -> PostgREST real -> PostgreSQL desechable.
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const http = require('node:http');
const secret = crypto.randomBytes(32).toString('hex');
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const payload = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ role: 'catalog_reader', exp: Math.floor(Date.now() / 1000) + 600 })}`;
const key = `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
const root = path.resolve(__dirname, '../..');
const id = `cf-catalog-test-${process.pid}-${Date.now()}`;
const pg = `${id}-db`, rest = `${id}-rest`;
const docker = (args, input) => execFileSync('docker', args,
  { input, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sql = input => docker(['exec', '-i', pg, 'psql', '-U', 'postgres', '-d', 'catalog', '-v', 'ON_ERROR_STOP=1'], input);
async function main() {
  let network = false;
  let proxy;
  try {
    docker(['network', 'create', id]); network = true;
    docker(['run', '-d', '--name', pg, '--network', id,
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=catalog',
      process.env.TEST_POSTGRES_IMAGE || 'postgres:15']);
    let ready = false;
    for (let n = 0; n < 60; n++) {
      try { sql('SELECT 1;'); ready = true; break; } catch { await sleep(500); }
    }
    assert.ok(ready, 'PostgreSQL no inició');
    sql(`CREATE ROLE catalog_reader NOLOGIN;
      GRANT catalog_reader TO postgres;
      CREATE TABLE cafeterias(id bigint PRIMARY KEY, campus_id bigint, nombre text,
        descripcion text, hora_apertura time, hora_cierre time, telefono text, imagen_url text, activa boolean);
      CREATE TABLE productos(id bigint PRIMARY KEY, cafeteria_id bigint REFERENCES cafeterias,
        nombre text, precio numeric, activo boolean, eliminado_en timestamptz);
      INSERT INTO cafeterias(id,nombre,activa) VALUES (1,'Zeta',true),(2,'Alfa',true),(3,'Cerrada',false);
      INSERT INTO productos VALUES (1,1,'Zeta',1500,true,NULL),(2,2,'Alfa',2500,true,NULL),
        (3,1,'Inactivo',100,false,NULL),(4,1,'Borrado',100,true,now());
      GRANT USAGE ON SCHEMA public TO catalog_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO catalog_reader;`);
    docker(['run', '-d', '--name', rest, '--network', id, '-p', '127.0.0.1::3000',
      '-e', `PGRST_DB_URI=postgres://postgres@${pg}:5432/catalog`,
      '-e', 'PGRST_DB_ANON_ROLE=catalog_reader', '-e', 'PGRST_DB_SCHEMAS=public',
      '-e', `PGRST_JWT_SECRET=${secret}`,
      process.env.TEST_REST_IMAGE || 'public.ecr.aws/supabase/postgrest:v16.2']);
    const port = docker(['port', rest, '3000']).split(':').pop();
    const url = `http://127.0.0.1:${port}`;
    ready = false;
    for (let n = 0; n < 60; n++) {
      try { if ((await fetch(`${url}/productos`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } }
      catch {} await sleep(500);
    }
    if (!ready) throw new Error(`PostgREST no inició: ${docker(['logs', rest])}`);
    // Supabase publica PostgREST bajo /rest/v1; reenviar sin alterar respuestas.
    proxy = http.createServer((req, res) => {
      const upstream = http.request(`${url}${req.url.replace(/^\/rest\/v1/, '')}`, {
        method: req.method, headers: req.headers,
      }, incoming => { res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res); });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    });
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    process.env.SUPABASE_URL = `http://127.0.0.1:${proxy.address().port}`;
    process.env.SUPABASE_SERVICE_KEY = key;
    process.env.NODE_ENV = 'test';
    const requireMenus = createRequire(path.join(root, 'Microservices/ms-menus/package.json'));
    const request = requireMenus('supertest');
    const menus = require(path.join(root, 'Microservices/ms-menus/src/app'));
    const cafeterias = require(path.join(root, 'Microservices/ms-cafeterias/src/app'));
    let checks = 0;
    const check = async (name, fn) => { await fn(); checks++; console.log(`OK: ${name}`); };
    await check('cafeterías activas ordenadas desde PostgreSQL', async () => {
      const r = await request(cafeterias).get('/api/cafeterias').expect(200);
      assert.deepEqual(r.body.data.map(x => x.id), [2, 1]); assert.equal(r.body.total, 2);
    });
    await check('detalle activo y rechazo de cafetería inactiva/inexistente', async () => {
      assert.equal((await request(cafeterias).get('/api/cafeterias/1').expect(200)).body.data.nombre, 'Zeta');
      for (const n of [3, 999]) await request(cafeterias).get(`/api/cafeterias/${n}`).expect(404);
    });
    await check('catálogo excluye inactivos y eliminados, ordena y filtra cafetería', async () => {
      const r = await request(menus).get('/api/menus').expect(200);
      assert.deepEqual(r.body.data.map(x => x.id), [2, 1]);
      const filtered = await request(menus).get('/api/menus?cafeteria_id=1').expect(200);
      assert.deepEqual(filtered.body.data.map(x => x.id), [1]);
    });
    await check('detalle de producto comprueba disponibilidad persistida', async () => {
      assert.equal((await request(menus).get('/api/menus/1').expect(200)).body.data.precio, 1500);
      for (const n of [3, 4, 999]) await request(menus).get(`/api/menus/${n}`).expect(404);
    });
    await check('precios ignoran importes manipulados y respetan el orden solicitado', async () => {
      const r = await request(menus).post('/api/menus/precios').send({ items: [
        { producto_id: 2, cantidad: 1, precio: 1 }, { producto_id: 1, cantidad: 2, precio: 1 }] }).expect(200);
      assert.deepEqual(r.body.data.map(x => [x.id, x.precio]), [[2, 2500], [1, 1500]]);
      for (const n of [3, 4, 999]) await request(menus).post('/api/menus/precios')
        .send({ items: [{ producto_id: n, cantidad: 1 }] }).expect(404);
    });
    await check('actualización SQL se refleja en la próxima respuesta HTTP', async () => {
      sql('UPDATE productos SET precio=1700 WHERE id=1;');
      const r = await request(menus).post('/api/menus/precios')
        .send({ items: [{ producto_id: 1, cantidad: 1 }] }).expect(200);
      assert.equal(r.body.data[0].precio, 1700);
      sql('UPDATE productos SET activo=false WHERE id=1;');
      await request(menus).get('/api/menus/1').expect(404);
    });
    await check('sin permiso real de lectura responde 503 sin inventar datos', async () => {
      sql('REVOKE SELECT ON productos, cafeterias FROM catalog_reader;');
      for (const [app, resource] of [[menus, 'menus'], [cafeterias, 'cafeterias']]) {
        const r = await request(app).get(`/api/${resource}`).expect(503);
        assert.equal(r.body.data, undefined);
      }
    });
    console.log(`${checks} escenarios reales de catálogo aprobados.`);
  } finally {
    if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
    for (const name of [rest, pg]) {
      try { docker(['rm', '-f', name]); } catch (e) { console.error(`Limpieza ${name}: ${e.message}`); }
    }
    if (network) docker(['network', 'rm', id]);
  }
}
main().catch(e => { console.error(e.stderr?.toString() || e.stack); process.exitCode = 1; });
