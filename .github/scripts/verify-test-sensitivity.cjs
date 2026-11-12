// Mutaciones sobre copias temporales: jamás se cambia el código de trabajo.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const source = path.resolve(__dirname, '../../app-mobile/tabla_mobile');
const cases = [
  ['compra sin descuento de stock', 'rpc_qr.sql', "p.stock - (d->>'cantidad')::INTEGER", 'p.stock', 'suficiente'],
  ['compra sin cobro de wallet', 'rpc_qr.sql', 'saldo_actual - v_total', 'saldo_actual', 'suficiente'],
  ['cancelación sin reposición', 'rpc_cancelar_pedido.sql', 'stock=p.stock+d.cantidad::INTEGER', 'stock=p.stock', 'cancelacion normal'],
  ['cancelación sin reembolso', 'rpc_cancelar_pedido.sql', 'saldo_actual + v_monto', 'saldo_actual', 'cancelacion normal'],
];
for (const [name, file, before, after, expected] of cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sensitivity-'));
  try {
    fs.cpSync(source, dir, { recursive: true });
    const target = path.join(dir, file);
    const original = fs.readFileSync(target, 'utf8');
    if (original.split(before).length !== 2) throw new Error(`Mutación ambigua: ${name}`);
    fs.writeFileSync(target, original.replace(before, after));
    const result = spawnSync(process.execPath, [path.join(dir, 'tests/run-procesar-pago.cjs')],
      { encoding: 'utf8', timeout: 120000, env: process.env });
    const output = (result.stdout || '') + (result.stderr || '');
    // Un error de infraestructura o sintaxis no cuenta como detección funcional.
    if (result.error || result.status === 0 || !output.includes(`ERROR:  ${expected}`)) {
      throw new Error(`La prueba no detectó el fallo esperado: ${name}\n${output}`);
    }
    console.log(`DETECTADO: ${name} -> aserción ${expected}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
