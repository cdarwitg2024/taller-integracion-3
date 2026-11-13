// Cada defecto se introduce en una copia aislada; se exige una aserción fallida.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const cases = [
  ['ms-cafeterias', 'Microservices/ms-cafeterias', 'src/modules/cafeterias/cafeterias.service.js',
    "consulta.eq('activa', true)", "consulta.eq('activa', false)", 'tests/cafeterias.test.js'],
  ['ms-menus', 'Microservices/ms-menus', 'src/modules/menus/menus.service.js',
    'precio: p.precio,', 'precio: 1,', 'tests/menus.test.js'],
  ['ms-pedidos', 'Microservices/ms-pedidos', 'src/modules/pedidos/pedidos.maquina-estados.js',
    "en_preparacion: ['listo']", "en_preparacion: ['listo', 'cancelado']", 'tests/pedidos.test.js'],
  ['mobile', 'app-mobile', 'src/utils/productos.js',
    'if (!activo || eliminado)', 'if (false)', 'src/utils/productos.test.js'],
  ['mobile', 'app-mobile', 'src/screens/PedidosScreen.js',
    'import { apiPatch, ApiError }', 'import { apiPatch }', 'src/screens/PedidosScreen.test.js'],
  ['desktop', 'app-desktop', 'src/services/productos.js',
    "if (stockAnterior !== undefined) query = query.eq('stock', stockAnterior);", '', 'tests/panel-dueno.test.cjs'],
  ['desktop', 'app-desktop', 'src/services/cargadorDashboard.js',
    '        estado.loading = false;\n        notificar();\n      }\n    }\n  };',
    '        if (showLoading) estado.loading = false;\n        notificar();\n      }\n    }\n  };', 'tests/dashboard.test.cjs'],
  ['desktop', 'app-desktop', 'src/pages/dueno/Dashboard.jsx',
    'estado.cafeteriaId === normalizarCafeteriaId(cafeteriaId)', 'true', 'tests/dashboard.test.cjs'],
  ['backend', 'backend-node', 'src/modules/pedidos/pedidos.maquina-estados.js',
    "const ESTADO_INICIAL = 'Pagado';", "const ESTADO_INICIAL = 'Creado';", 'tests/maquina-estados.test.js'],
];
const selected = process.argv[2];
assert.ok(!selected || cases.some(c => c[0] === selected), 'Proyecto de mutación desconocido');
for (const [name, folder, file, before, after, test] of cases.filter(c => !selected || c[0] === selected)) {
  const source = path.join(root, folder);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-unit-sensitivity-'));
  try {
    for (const entry of ['src', 'tests', '__tests__', 'assets', 'jest.config.js', 'jest.setup.js', 'babel.config.js', 'package.json']) {
      if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(dir, entry), { recursive: true });
    }
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const target = path.join(dir, file), original = fs.readFileSync(target, 'utf8');
    assert.equal(original.split(before).length, 2, `Mutación ambigua: ${name}`);
    fs.writeFileSync(target, original.replace(before, after));
    const output = path.join(dir, 'results.json');
    const args = name === 'desktop' ? ['--test', '--test-reporter=tap', test] : [
      path.join(source, 'node_modules/jest/bin/jest.js'), '--runInBand', '--ci', '--silent',
      '--cacheDirectory', path.join(dir, '.cache'), '--runTestsByPath', test, '--json', '--outputFile', output,
    ];
    const result = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', timeout: 120000 });
    const log = (result.stdout || '') + (result.stderr || '');
    assert.ok(!result.error && result.status !== 0, `No detectado: ${name}\n${log}`);
    if (name === 'desktop') assert.match(log, /ERR_ASSERTION/, log);
    else {
      assert.ok(fs.existsSync(output), log);
      const report = JSON.parse(fs.readFileSync(output));
      assert.ok(report.numFailedTests > 0, `Falló infraestructura, no una aserción: ${name}\n${log}`);
    }
    console.log(`DETECTADO: ${name} (${file})`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
