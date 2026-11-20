// C03: gateway nginx -> Express real -> Auth/GoTrue y PostgREST reales -> RLS/RPC.
// Todos los recursos y cuentas se crean en contenedores desechables. Sin .env ni Cloud.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const probarC05 = process.argv.includes('--c05');
const id = `cf-c03-auth-${process.pid}-${Date.now()}`;
const names = { pg: `${id}-db`, auth: `${id}-auth`, rest: `${id}-rest`, gateway: `${id}-gateway` };
const secret = crypto.randomBytes(40).toString('hex');
const password = crypto.randomBytes(24).toString('hex');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
// Solo la API key anónima es generada aquí. Cada JWT de usuario lo emite Auth.
const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const anon = `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
function docker(args, input) {
  try {
    return execFileSync('docker', args, { input, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    // No imprimir argumentos de docker que contienen las claves efímeras.
    throw new Error(`Docker ${args[0]} falló: ${error.stderr || error.code || 'sin respuesta'}`);
  }
}
const sql = text => docker(['exec', '-i', names.pg, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], text);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(name, check) {
  for (let n = 0; n < 60; n++) {
    try { if (await check()) return; } catch {}
    await sleep(500);
  }
  const container = name === 'Supabase Auth' ? names.auth : name === 'PostgREST' ? names.rest : null;
  let detail = '';
  if (container) {
    const result = spawnSync('docker', ['logs', '--tail', '12', container], { encoding: 'utf8' });
    const logs = (result.stdout || '') + (result.stderr || '');
    detail = logs.replaceAll(secret, '[redactado]').replaceAll(password, '[redactado]');
  }
  throw new Error(`${name} no inició dentro de 30 segundos. ${detail}`);
}
const portOf = (name, port) => docker(['port', name, String(port)]).split(':').pop();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-c03-auth-'));
  let server, network = false, checks = 0;
  const check = async (name, fn) => { await fn(); checks++; console.log(`OK: ${name}`); };
  try {
    docker(['network', 'create', id]); network = true;
    docker(['run', '-d', '--name', names.pg, '--network', id,
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', process.env.TEST_POSTGRES_IMAGE || 'postgres:15']);
    await waitFor('PostgreSQL', () => docker(['logs', names.pg]).includes('PostgreSQL init process complete; ready for start up.') && sql('SELECT 1;') === '1');
    console.log('PREPARADO: PostgreSQL desechable');
    sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${password}';
      GRANT anon, authenticated, service_role TO authenticator;
      CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD '${password}';
      CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
      CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;
      GRANT CREATE ON DATABASE postgres TO supabase_auth_admin;
      ALTER ROLE supabase_auth_admin SET search_path = auth, public, extensions;
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
      $$;
      ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
      CREATE TABLE public.cafeterias(id bigint PRIMARY KEY);
      CREATE TABLE public.roles(id bigint PRIMARY KEY, nombre text, activo boolean NOT NULL DEFAULT true);
      CREATE TABLE public.usuarios(id bigint PRIMARY KEY, rol_id bigint, activo boolean, auth_user_id uuid);
      CREATE TABLE public.cafeteria_usuarios(usuario_id bigint, cafeteria_id bigint);
      INSERT INTO public.cafeterias VALUES (7),(8);
      INSERT INTO public.roles VALUES (1,'dueno',true),(2,'empleado',true),(3,'dueno',false),(4,'estudiante',true);`);
    // Reutiliza las definiciones V05 ya versionadas: tabla, identidad, RLS,
    // privilegios, trigger y aceptación. No reutiliza la simulación de auth.uid().
    const fixture = fs.readFileSync(path.join(root, 'database/fixes/prueba_administrar_campanas_afiliados.sql'), 'utf8');
    const start = fixture.indexOf('CREATE TABLE public.campanas (');
    const end = fixture.indexOf('CREATE TABLE public.cf_test_ids');
    assert.ok(start > 0 && end > start, 'No se encontraron las dependencias V05');
    sql(fixture.slice(start, end));
    sql(fs.readFileSync(path.join(root, 'database/fixes/administrar_campanas_afiliados.sql'), 'utf8'));
    console.log('PREPARADO: dependencias V05 y migración C03');
    if (probarC05) {
      const migrations = process.env.COFFEEFAST_DB_MIGRATIONS ||
        path.resolve(root, '../db_CoffeeFaster/supabase/migrations');
      sql(`ALTER TABLE public.cafeterias ADD COLUMN nombre text NOT NULL DEFAULT 'Cafetería de prueba',
          ADD COLUMN activa boolean NOT NULL DEFAULT true;
        ALTER TABLE public.usuarios ADD COLUMN nombre text NOT NULL DEFAULT 'Cuenta', ADD COLUMN apellido text;
        CREATE TABLE public.pedidos(id bigint PRIMARY KEY, cafeteria_id bigint NOT NULL);`);
      for (const version of ['0020', '0021', '0023', '0024']) {
        const files = fs.readdirSync(migrations).filter(file => file.startsWith(`${version}_`) && file.endsWith('.sql'));
        assert.equal(files.length, 1, `Migración oficial ${version}`);
        sql(fs.readFileSync(path.join(migrations, files[0]), 'utf8'));
      }
      sql(fs.readFileSync(path.join(root, 'database/fixes/exponer_solicitudes_afiliacion.sql'), 'utf8'));
    }

    docker(['run', '-d', '--name', names.auth, '--network', id, '-p', '127.0.0.1::9999',
      '-e', 'GOTRUE_API_HOST=0.0.0.0', '-e', 'GOTRUE_API_PORT=9999',
      '-e', 'API_EXTERNAL_URL=http://localhost/auth/v1', '-e', 'GOTRUE_SITE_URL=http://localhost',
      '-e', 'GOTRUE_DB_DRIVER=postgres',
      '-e', `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${password}@${names.pg}:5432/postgres`,
      '-e', `GOTRUE_JWT_SECRET=${secret}`, '-e', 'GOTRUE_JWT_AUD=authenticated',
      '-e', 'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated', '-e', 'GOTRUE_JWT_ADMIN_ROLES=service_role',
      '-e', 'GOTRUE_JWT_EXP=3600', '-e', 'GOTRUE_DISABLE_SIGNUP=false',
      '-e', 'GOTRUE_EXTERNAL_EMAIL_ENABLED=true', '-e', 'GOTRUE_MAILER_AUTOCONFIRM=true',
      process.env.TEST_AUTH_IMAGE || 'public.ecr.aws/supabase/gotrue:v2.196.0']);
    const authUrl = `http://127.0.0.1:${portOf(names.auth, 9999)}`;
    await waitFor('Supabase Auth', async () => (await fetch(`${authUrl}/health`, { signal: AbortSignal.timeout(2000) })).ok);
    // La primera migración histórica de GoTrue instala el helper de claims
    // individuales. PostgREST moderno usa request.jwt.claims (JSON); esta es
    // la definición compatible de Supabase, leyendo exclusivamente claims del JWT.
    sql(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    $$;`);
    console.log('PREPARADO: Supabase Auth real');
    docker(['run', '-d', '--name', names.rest, '--network', id, '-p', '127.0.0.1::3000',
      '-e', `PGRST_DB_URI=postgres://authenticator:${password}@${names.pg}:5432/postgres`,
      '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${secret}`,
      ...(probarC05 ? ['-e', 'PGRST_DB_MAX_ROWS=2'] : []),
      process.env.TEST_REST_IMAGE || 'public.ecr.aws/supabase/postgrest:v16.2']);
    const restUrl = `http://127.0.0.1:${portOf(names.rest, 3000)}`;
    await waitFor('PostgREST', async () => (await fetch(`${restUrl}/`, { signal: AbortSignal.timeout(2000) })).ok);

    // La app real corre con la publishable/anon key: nunca service_role.
    const http = require('node:http');
    const supabaseProxy = http.createServer((req, res) => {
      const isAuth = req.url.startsWith('/auth/v1/');
      const target = (isAuth ? authUrl : restUrl) + req.url.replace(/^\/(auth|rest)\/v1/, '');
      const upstream = http.request(target, { method: req.method, headers: req.headers }, incoming => {
        res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream);
    });
    await new Promise(resolve => supabaseProxy.listen(0, '127.0.0.1', resolve));
    server = { proxy: supabaseProxy };
    process.env.SUPABASE_URL = `http://127.0.0.1:${supabaseProxy.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = anon;
    delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_KEY; delete process.env.SUPABASE_ANON_KEY;
    const app = require(path.join(root, 'Microservices/ms-afiliados/src/app'));
    server.app = await new Promise(resolve => { const listener = app.listen(0, '0.0.0.0', () => resolve(listener)); });
    // Usa las reglas reales del gateway; solo sustituye los destinos para aislar la prueba.
    let nginx = fs.readFileSync(path.join(root, 'Microservices/gateway/nginx.conf'), 'utf8')
      .replace(/http:\/\/ms-(afiliados|pedidos|menus|cafeterias):\d+/g, `http://host.docker.internal:${server.app.address().port}`);
    nginx = nginx.replace('  location / {', `  location /auth/v1/ { proxy_pass http://${names.auth}:9999/; }
      location /rest/v1/ { proxy_pass http://${names.rest}:3000/; }
      location / {`);
    fs.writeFileSync(path.join(temp, 'nginx.conf'), nginx);
    docker(['run', '-d', '--name', names.gateway, '--network', id, '--add-host', 'host.docker.internal:host-gateway',
      '-p', '127.0.0.1::80', '-v', `${path.join(temp, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`,
      process.env.TEST_GATEWAY_IMAGE || 'nginx:1.27-alpine']);
    const base = `http://127.0.0.1:${portOf(names.gateway, 80)}`;
    await waitFor('Gateway', async () => (await fetch(`${base}/gateway/health`, { signal: AbortSignal.timeout(2000) })).ok);
    console.log('PREPARADO: gateway nginx y ms-afiliados reales');

    async function call(url, token, method = 'GET', body) {
      const response = await fetch(base + url, { method, headers: {
        apikey: anon, ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      return { status: response.status, body: result };
    }
    const tokens = {};
    const identities = [['dueno',1,1,true,7], ['otro',2,1,true,8], ['empleado',3,2,true,7],
      ['inactivo',4,1,false,7], ['rol_inactivo',5,3,true,7], ['estudiante',6,4,true,7]];
    for (const [name, userId, rolId, active, cafe] of identities) {
      const credentials = { email: `${name}-${id}@example.test`, password };
      const signup = await call('/auth/v1/signup', null, 'POST', credentials);
      assert.equal(signup.status, 200, `Alta Auth ${name}: ${signup.body.msg || signup.body.error || signup.status}`);
      const login = await call('/auth/v1/token?grant_type=password', null, 'POST', credentials);
      assert.equal(login.status, 200, `Login Auth ${name}`);
      assert.ok(login.body.access_token && login.body.user.id, `JWT real ${name}`);
      tokens[name] = login.body.access_token;
      sql(`INSERT INTO public.usuarios VALUES (${userId},${rolId},${active},${quote(login.body.user.id)});
        INSERT INTO public.cafeteria_usuarios VALUES (${userId},${cafe});`);
    }
    if (probarC05) {
      await require('./test-solicitudes-afiliacion-c05.cjs')({ check, call, sql, tokens });
      console.log(`${checks} escenarios C05 con Auth, JWT, gateway y PostgreSQL reales aprobados.`);
      return;
    }
    const resource = '/api/afiliados/cafeterias/7/campanas';
    const form = { nombre: 'Campaña C03 JWT real', descuento_normal_pct: 15, descuento_oferta_pct: 5, comision_pct: 10,
      inicio: new Date(Date.now() + 86400000).toISOString(), fin: new Date(Date.now() + 172800000).toISOString() };
    let created;
    await check('dueño: crear, listar y editar por gateway con JWT real', async () => {
      const post = await call(resource, tokens.dueno, 'POST', form);
      assert.equal(post.status, 201, JSON.stringify(post.body)); created = post.body.id;
      const list = await call(`${resource}/administracion`, tokens.dueno);
      assert.equal(list.status, 200, JSON.stringify(list.body));
      assert.deepEqual(list.body.campanas.map(c => c.id), [created]);
      assert.equal(list.body.campanas[0].descuento_oferta_pct, 5);
      const edit = await call(`${resource}/${created}`, tokens.dueno, 'PATCH', { descuento_normal_pct: 12 });
      assert.equal(edit.status, 200, JSON.stringify(edit.body));
      assert.equal(edit.body.version_condiciones, '1.1'); assert.equal(edit.body.descuento_normal_pct, 12);
    });
    // Campaña iniciada pero sin confirmar: la aceptación se hace por RPC real.
    const acceptable = JSON.parse(sql(`INSERT INTO public.campanas(cafeteria_id,nombre,estado,tasa_descuento,tasa_descuento_oferta,tasa_comision,vigencia_desde,vigencia_hasta)
      VALUES (7,'Aceptación real','pendiente_aceptacion',15,5,10,now()-interval '1 hour',now()+interval '1 day')
      RETURNING json_build_object('id',id,'version',version_condiciones);` ).split('\n')[0]);
    await check('aceptación V05 real, pausa y reanudación del dueño', async () => {
      const accepted = await call('/rest/v1/rpc/confirmar_condiciones_campana', tokens.dueno, 'POST', {
        p_campana_id: acceptable.id, p_cafeteria_id: 7, p_version: acceptable.version,
      });
      assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
      assert.equal(accepted.body.confirmada_por_dueno, true);
      for (const [pausada, state] of [[true,'pausada'], [false,'activa']]) {
        const response = await call(`${resource}/${acceptable.id}`, tokens.dueno, 'PATCH', { pausada });
        assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(response.body.estado, state);
      }
    });
    for (const who of ['otro', 'empleado', 'inactivo', 'rol_inactivo', 'estudiante']) {
      await check(`${who}: rechaza listado, alta, edición, pausa y reanudación (403)`, async () => {
        const requests = [[`${resource}/administracion`,'GET'], [resource,'POST',form],
          [`${resource}/${created}`,'PATCH',{nombre:'Intento ajeno'}],
          [`${resource}/${acceptable.id}`,'PATCH',{pausada:true}], [`${resource}/${acceptable.id}`,'PATCH',{pausada:false}]];
        for (const [url, method, body] of requests) {
          const r = await call(url,tokens[who],method,body);
          assert.equal(r.status,403, `${who} ${method} ${url}: ${JSON.stringify(r.body)}`);
          assert.equal(r.body.error,'sin_acceso_cafeteria');
        }
      });
    }
    await check('otro dueño administra su cafetería y no una campaña de 7 bajo URL 8', async () => {
      const other = '/api/afiliados/cafeterias/8/campanas';
      assert.equal((await call(other,tokens.otro,'POST',form)).status,201);
      assert.equal((await call(`${other}/administracion`,tokens.otro)).status,200);
      assert.equal((await call(`${other}/${created}`,tokens.otro,'PATCH',{nombre:'Cruce'})).status,403);
    });
    await check('sin sesión, JWT inválido o firma adulterada: 401 en las cinco operaciones', async () => {
      for (const token of [null, 'invalido', tokens.dueno.slice(0,-8) + 'AAAAAAAA']) {
        for (const [url,method,body] of [[`${resource}/administracion`,'GET'],[resource,'POST',form],
          [`${resource}/${created}`,'PATCH',{nombre:'Sin sesión'}],
          [`${resource}/${acceptable.id}`,'PATCH',{pausada:true}],[`${resource}/${acceptable.id}`,'PATCH',{pausada:false}]]) {
          assert.equal((await call(url,token,method,body)).status,401);
        }
      }
    });
    await check('RLS real: solo el dueño lee sus campañas y escrituras directas quedan prohibidas', async () => {
      for (const who of ['dueno','otro','empleado','inactivo','rol_inactivo','estudiante']) {
        const read = await call('/rest/v1/campanas?select=id,cafeteria_id',tokens[who]);
        assert.equal(read.status,200,JSON.stringify(read.body));
        if (['dueno','otro'].includes(who)) {
          assert.ok(read.body.length > 0); assert.ok(read.body.every(c=>c.cafeteria_id === (who === 'dueno' ? 7 : 8)));
        } else assert.deepEqual(read.body,[]);
        for (const method of ['POST','PATCH','DELETE']) {
          const write = await call(`/rest/v1/campanas?id=eq.${created}`,tokens[who],method,method === 'DELETE' ? undefined : { nombre:'Directo' });
          assert.equal(write.status,403,`${who} ${method}: ${JSON.stringify(write.body)}`);
        }
      }
    });
    await check('C04 rechaza postulables sin exponer datos administrativos', async () => {
      const r = await call(`${resource}?postulables=true`,tokens.estudiante);
      assert.equal(r.status,400); assert.equal(r.body.error,'parametros_no_admitidos');
      assert.equal((await call(`${resource}?postulables=true`,tokens.dueno)).status,400);
    });
    await check('los rechazos no alteraron las campañas persistidas', async () => {
      const r = await call(`${resource}/administracion`,tokens.dueno);
      assert.equal(r.status,200); assert.equal(r.body.campanas.find(c=>c.id===created).nombre,form.nombre);
      assert.equal(r.body.campanas.find(c=>c.id===acceptable.id).estado,'activa');
      assert.equal(r.body.campanas.length,2);
    });
    console.log(`${checks} escenarios C03 con Auth, JWT, gateway, PostgREST y RLS reales aprobados.`);
  } finally {
    for (const listener of server ? [server.app, server.proxy].filter(Boolean) : []) {
      listener.closeAllConnections(); await new Promise(resolve=>listener.close(resolve));
    }
    for (const name of [names.gateway,names.rest,names.auth,names.pg]) {
      try { docker(['rm','-f','-v',name]); } catch (error) { console.error(`Limpieza ${name}: ${error.message}`); }
    }
    if (network) docker(['network','rm',id]);
    // temp fue creado por este proceso con mkdtemp, dentro del directorio temporal.
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('cf-c03-auth-'));
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{ console.error(error.message); process.exitCode=1; });
