// A03: pantalla Mobile -> gateway -> servicios -> Auth/PostgREST/PostgreSQL reales.
// Solo crea contenedores, cuentas y datos desechables. No lee .env ni usa Cloud.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const id = `cf-a03-${process.pid}-${Date.now()}`;
const names = Object.fromEntries(['db', 'auth', 'rest', 'gateway'].map(n => [n, `${id}-${n}`]));
const secret = crypto.randomBytes(40).toString('hex');
const password = crypto.randomBytes(24).toString('hex');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const claims = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const anon = `${claims}.${crypto.createHmac('sha256', secret).update(claims).digest('base64url')}`;
const migrations = process.env.COFFEEFAST_DB_MIGRATIONS ||
  path.resolve(root, '../db_CoffeeFaster/supabase/migrations');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function docker(args, input) {
  try { return execFileSync('docker', args, { input, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch (error) { throw new Error(`Docker ${args[0]}: ${error.stderr || error.code}`); }
}
const sql = text => docker(['exec', '-i', names.db, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], text);
const port = (name, internal) => docker(['port', name, String(internal)]).split(':').pop();
async function waitFor(check) {
  for (let n = 0; n < 90; n++) {
    try { if (await check()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Un servicio desechable no inició dentro de 45 segundos');
}
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-a03-'));
  let proxy, server, network = false;
  try {
    const rpcPath = path.join(migrations, '0024_s3_t4_rpc_campanas_vigentes.sql');
    const rpcSql = fs.readFileSync(rpcPath, 'utf8');
    assert.match(rpcSql, /CREATE OR REPLACE FUNCTION public\.listar_oportunidades_campana/);
    docker(['network', 'create', id]); network = true;
    docker(['run', '-d', '--name', names.db, '--network', id,
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', process.env.TEST_POSTGRES_IMAGE || 'postgres:15']);
    await waitFor(() => docker(['logs', names.db]).includes('PostgreSQL init process complete; ready for start up.')
      && sql('SELECT 1') === '1');
    sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD ${quote(password)};
      GRANT anon, authenticated, service_role TO authenticator;
      CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD ${quote(password)};
      CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
      CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;
      GRANT CREATE ON DATABASE postgres TO supabase_auth_admin;
      ALTER ROLE supabase_auth_admin SET search_path = auth, public, extensions;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      CREATE TABLE public.roles(id bigint PRIMARY KEY, nombre text, activo boolean);
      CREATE TABLE public.usuarios(id bigint PRIMARY KEY, auth_user_id uuid, rol_id bigint, activo boolean);
      CREATE TABLE public.cafeterias(id bigint PRIMARY KEY, nombre text, activa boolean, campus_id bigint,
        descripcion text, hora_apertura time, hora_cierre time, telefono text, imagen_url text);
      CREATE TABLE public.campanas(id bigint PRIMARY KEY, nombre varchar(150), cafeteria_id bigint,
        tipo varchar(50), estado varchar(30), vigencia_desde timestamptz, vigencia_hasta timestamptz,
        tasa_descuento numeric(5,2), tasa_comision numeric(5,2));
      ALTER TABLE public.cafeterias ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.cafeterias TO anon, authenticated;
      CREATE POLICY cafeteria_publica ON public.cafeterias FOR SELECT TO anon, authenticated USING (activa);
      ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.campanas FROM anon, authenticated;
      INSERT INTO public.roles VALUES (1,'estudiante',true);
      INSERT INTO public.cafeterias(id,nombre,activa) VALUES (7,'Norte A03',true),(8,'Sur A03',true);
      INSERT INTO public.campanas VALUES
        (31,'Activa A03',7,'carrito_completo','activa',now()-interval '1 hour',now()+interval '1 day',15,10),
        (32,'Pausada A03',7,'carrito_completo','pausada',now()-interval '1 hour',now()+interval '1 day',20,5),
        (33,'Vencida A03',7,'carrito_completo','activa',now()-interval '2 days',now()-interval '1 day',12,8);`);
    docker(['run', '-d', '--name', names.auth, '--network', id, '-p', '127.0.0.1::9999',
      '-e', 'GOTRUE_API_HOST=0.0.0.0', '-e', 'GOTRUE_API_PORT=9999',
      '-e', 'API_EXTERNAL_URL=http://localhost/auth/v1', '-e', 'GOTRUE_SITE_URL=http://localhost',
      '-e', 'GOTRUE_DB_DRIVER=postgres',
      '-e', `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${password}@${names.db}:5432/postgres`,
      '-e', `GOTRUE_JWT_SECRET=${secret}`, '-e', 'GOTRUE_JWT_AUD=authenticated',
      '-e', 'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated', '-e', 'GOTRUE_JWT_EXP=3600',
      '-e', 'GOTRUE_DISABLE_SIGNUP=false', '-e', 'GOTRUE_EXTERNAL_EMAIL_ENABLED=true',
      '-e', 'GOTRUE_MAILER_AUTOCONFIRM=true',
      process.env.TEST_AUTH_IMAGE || 'public.ecr.aws/supabase/gotrue:v2.197.0']);
    const authUrl = `http://127.0.0.1:${port(names.auth, 9999)}`;
    await waitFor(async () => (await fetch(`${authUrl}/health`, { signal: AbortSignal.timeout(2000) })).ok);
    sql(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;`);
    sql(rpcSql);
    docker(['run', '-d', '--name', names.rest, '--network', id, '-p', '127.0.0.1::3000',
      '-e', `PGRST_DB_URI=postgres://authenticator:${password}@${names.db}:5432/postgres`,
      '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${secret}`,
      process.env.TEST_REST_IMAGE || 'public.ecr.aws/supabase/postgrest:v16.3']);
    const restUrl = `http://127.0.0.1:${port(names.rest, 3000)}`;
    await waitFor(async () => (await fetch(`${restUrl}/`, { signal: AbortSignal.timeout(2000) })).ok);
    proxy = http.createServer((req, res) => {
      const target = (req.url.startsWith('/auth/v1/') ? authUrl : restUrl) + req.url.replace(/^\/(auth|rest)\/v1/, '');
      const upstream = http.request(target, { method: req.method, headers: req.headers }, incoming => {
        res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream);
    });
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    process.env.SUPABASE_URL = `http://127.0.0.1:${proxy.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = anon;
    delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_KEY; delete process.env.SUPABASE_ANON_KEY;
    const afiliados = require(path.join(root, 'Microservices/ms-afiliados/src/app'));
    const cafeterias = require(path.join(root, 'Microservices/ms-cafeterias/src/app'));
    server = http.createServer((req, res) => (req.url.startsWith('/api/cafeterias') ? cafeterias : afiliados)(req, res));
    await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
    let nginx = fs.readFileSync(path.join(root, 'Microservices/gateway/nginx.conf'), 'utf8')
      .replace(/http:\/\/ms-(afiliados|pedidos|menus|cafeterias):\d+/g, `http://host.docker.internal:${server.address().port}`);
    nginx = nginx.replace('  location / {', `  location /auth/v1/ { proxy_pass http://${names.auth}:9999/; }\n  location / {`);
    fs.writeFileSync(path.join(temp, 'nginx.conf'), nginx);
    docker(['run', '-d', '--name', names.gateway, '--network', id, '--add-host', 'host.docker.internal:host-gateway',
      '-p', '127.0.0.1::80', '-v', `${path.join(temp, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`,
      process.env.TEST_GATEWAY_IMAGE || 'nginx:1.27-alpine']);
    const base = `http://127.0.0.1:${port(names.gateway, 80)}`;
    await waitFor(async () => (await fetch(`${base}/gateway/health`, { signal: AbortSignal.timeout(2000) })).ok);
    const credentials = { email: `${id}@example.test`, password };
    const authCall = async url => {
      const response = await fetch(base + url, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
      assert.equal(response.status, 200, 'Auth local debe aceptar la cuenta desechable');
      return response.json();
    };
    await authCall('/auth/v1/signup');
    const session = await authCall('/auth/v1/token?grant_type=password');
    assert.ok(session.access_token && session.user.id, 'JWT real emitido por Auth');
    sql(`INSERT INTO public.usuarios VALUES (901,${quote(session.user.id)},1,true)`);
    console.log('PREPARADO: campañas 31 activa, 32 pausada y 33 vencida persistidas; RPC oficial 0024; JWT real');
    const response = await fetch(`${base}/api/afiliados/cafeterias/7/campanas`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).campanas.map(c => c.id), [31]);
    console.log('PASS: C04 por gateway devuelve únicamente la campaña activa 31');
    // El JWT solo viaja en memoria al proceso de prueba, nunca en argumentos ni archivos.
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(root, 'app-mobile/node_modules/jest/bin/jest.js'),
        '--config', path.join(root, 'app-mobile/jest.config.js'), '--ci', '--runInBand', '--testTimeout=20000',
        '--runTestsByPath', path.join(root, 'app-mobile/src/screens/afiliaciones/OportunidadesIntegracion.test.js')], {
        cwd: path.join(root, 'app-mobile'), stdio: 'inherit',
        env: { ...process.env, EXPO_PUBLIC_API_URL: base, A03_INTEGRATION_URL: base, A03_INTEGRATION_TOKEN: session.access_token },
      });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Integración Mobile: salida ${code}`)));
    });
    console.log('PASS: A03 con catálogo, C04, Auth, gateway y datos PostgreSQL reales desechables');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    for (const name of Object.values(names).reverse()) { try { docker(['rm', '-f', '-v', name]); } catch {} }
    if (network) { try { docker(['network', 'rm', id]); } catch {} }
    const temporalReal = fs.realpathSync(temp);
    const baseTemporal = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(temporalReal), baseTemporal, 'La limpieza debe quedar dentro del temporal local');
    assert.ok(path.basename(temporalReal).startsWith('cf-a03-'), 'Carpeta temporal inesperada');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
const guardia = setInterval(() => {}, 1000);
main().catch(error => {
  console.error(String(error.message).replaceAll(secret, '[omitido]').replaceAll(password, '[omitido]'));
  process.exitCode = 1;
}).finally(() => clearInterval(guardia));
