// Pruebas reales en PostgreSQL local aislado. Requiere Docker y el contenedor indicado.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const db = 'cf_panel_test_' + Date.now();
const container = process.env.TEST_POSTGRES_CONTAINER || 'supabase_db_db_CoffeeFaster';
const run = (args, input) => cp.execFileSync('docker', ['exec', '-i', container, ...args],
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 });
let created = false;
(async () => {
  try {
    run(['createdb', '-U', 'postgres', db]);
    created = true;
    const sql = fs.readFileSync(path.join(__dirname, 'procesar_pago.sql'), 'utf8')
      .replace('-- RPC_INJECT', () => fs.readFileSync(path.join(__dirname, '../rpc_qr.sql'), 'utf8'));
    console.log(run(['psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], sql).split('\n').slice(-8).join('\n'));
    const buy = () => new Promise((resolve, reject) => {
      const p = cp.spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1']);
      let out = '';
      p.stdout.on('data', d => out += d);
      p.stderr.on('data', d => out += d);
      p.on('error', reject);
      p.on('close', c => c ? reject(new Error(out)) : resolve(out));
      p.stdin.end(`BEGIN; SELECT procesar_pago(1,'[{"producto_id":1,"cantidad":3}]'); SELECT pg_sleep(0.5); COMMIT;`);
    });
    const purchases = await Promise.allSettled([buy(), buy()]);
    const failure = purchases.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    const results = purchases.map(r => r.value);
    if (results.filter(x => x.includes('"ok": true')).length !== 1 ||
        results.filter(x => x.includes('stock_insuficiente')).length !== 1) throw new Error('Concurrencia incorrecta');
    const stock = run(['psql', '-U', 'postgres', '-d', db, '-At'], 'SELECT stock FROM productos WHERE id=1;').trim();
    if (stock !== '0') throw new Error('Stock final incorrecto');
    console.log('Concurrencia aprobada: una compra exitosa, otra rechazada y stock final 0.');
    const cancelSql = fs.readFileSync(path.join(__dirname, 'cancelar_pedido.sql'), 'utf8')
      .replace('-- CANCEL_RPC_INJECT', () => fs.readFileSync(path.join(__dirname, '../rpc_cancelar_pedido.sql'), 'utf8'));
    console.log(run(['psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], cancelSql).split('\n').slice(-8).join('\n'));
    const cancel = () => new Promise((resolve, reject) => {
      const p = cp.spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1']);
      let out = '';
      p.stdout.on('data', d => out += d);
      p.stderr.on('data', d => out += d);
      p.on('error', reject);
      p.on('close', c => c ? reject(new Error(out)) : resolve(out));
      p.stdin.end('BEGIN; SELECT cancelar_pedido(1); SELECT pg_sleep(0.5); COMMIT;');
    });
    const attempts = await Promise.allSettled([cancel(), cancel()]);
    const cancelFailure = attempts.find(r => r.status === 'rejected');
    if (cancelFailure) throw cancelFailure.reason;
    const cancellations = attempts.map(r => r.value);
    if (cancellations.filter(x => x.includes('"ok": true')).length !== 1 ||
        cancellations.filter(x => x.includes('ya_cancelado')).length !== 1) throw new Error('Doble cancelacion concurrente');
    const final = run(['psql', '-U', 'postgres', '-d', db, '-At'],
      "SELECT (SELECT stock FROM productos WHERE id=1)=10 AND (SELECT saldo_actual FROM wallets WHERE id=1)=10000 AND (SELECT count(*) FROM movimientos_wallet WHERE tipo='reembolso')=1;").trim();
    if (final !== 't') throw new Error('Doble reposicion o reembolso');
    console.log('Cancelacion concurrente aprobada: stock 10, saldo 10000 y un solo reembolso.');
  } finally {
    if (created) run(['dropdb', '-U', 'postgres', db]);
  }
})().catch(e => { console.error(e.stderr?.toString() || e.message); process.exitCode = 1; });
