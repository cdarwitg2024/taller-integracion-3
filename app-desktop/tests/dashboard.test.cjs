const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function cargar(ruta, dependencias) {
  const archivo = path.join(__dirname, '../src', ruta);
  const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
    format: 'cjs', loader: 'jsx', jsx: 'automatic', sourcefile: archivo, target: 'node22',
  }).code;
  const modulo = { exports: {} };
  const importar = nombre => {
    if (nombre === 'react' || nombre === 'react/jsx-runtime') return require(nombre);
    assert.ok(Object.hasOwn(dependencias, nombre), `Import sin definir: ${nombre}`);
    return dependencias[nombre];
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  return modulo.exports;
}

const cargadores = cargar('services/cargadorDashboard.js', {
  './pedidosService': {},
  './resumenComisiones': { resumenComisiones: { obtener: async () => ({}) } },
});

function diferida() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function preparar(overrides = {}) {
  const solicitudes = [];
  const estados = [];
  const servicio = {
    getAll({ cafeteriaId }) {
      const solicitud = { ...diferida(), cafeteriaId };
      solicitudes.push(solicitud);
      return solicitud.promise;
    },
    getEstadisticas: async pedidos => ({ totalVentas: pedidos[0]?.total || 0, totalPedidos: pedidos.length }),
    getVentasPorHora: async pedidos => [{ hora: '12:00', ventas: pedidos[0]?.total || 0 }],
    getTopProductos: async pedidos => [{ nombre: pedidos[0]?.nombre || '', cantidad: 1 }],
    ...overrides,
  };
  const cargador = cargadores.crearCargadorDashboard({
    pedidosService: servicio,
    onEstadoCambiado: estado => estados.push(estado),
    obtenerFechaActual: () => '2026-11-13T12:34:56.000Z',
  });
  return { cargador, solicitudes, estados };
}

for (const falla of [false, true]) {
  for (const antiguaPrimero of [false, true]) {
    test(`carga inicial + refresco ${falla ? 'fallido' : 'exitoso'}; respuesta antigua ${antiguaPrimero ? 'primero' : 'después'}`, async () => {
      const { cargador, solicitudes, estados } = preparar();
      const inicial = cargador.cambiarCafeteria(1);
      const refresco = cargador.refrescar(true);
      assert.equal(cargador.obtenerEstado().loading, true);
      if (antiguaPrimero) {
        const antes = estados.length;
        solicitudes[0].resolve([{ id: 101, total: 9999 }]);
        await inicial;
        assert.equal(estados.length, antes);
        assert.equal(cargador.obtenerEstado().loading, true, 'La solicitud antigua no cierra la carga vigente');
      }
      if (falla) solicitudes[1].reject(new Error('Error de la carga vigente'));
      else solicitudes[1].resolve([{ id: 201, total: 500 }]);
      await refresco;
      const vigente = cargador.obtenerEstado();
      assert.equal(vigente.loading, false);
      assert.equal(vigente.cafeteriaId, '1');
      assert.equal(vigente.dbError, falla ? 'Error de la carga vigente' : null);
      assert.equal(vigente.stats?.totalVentas ?? null, falla ? null : 500);
      assert.equal(vigente.ultimaActualizacionExitosa, falla ? null : '2026-11-13T12:34:56.000Z');
      if (!antiguaPrimero) {
        const antes = estados.length;
        solicitudes[0].reject(new Error('Error antiguo que debe descartarse'));
        await inicial;
        assert.equal(estados.length, antes);
        assert.deepEqual(cargador.obtenerEstado(), vigente);
      }
    });
  }
}

test('un refresco silencioso conserva los datos visibles y no abre el indicador', async () => {
  const { cargador, solicitudes } = preparar();
  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 101, total: 100 }]);
  await inicial;
  const antes = cargador.obtenerEstado();
  const refresco = cargador.refrescar(false);
  assert.deepEqual(cargador.obtenerEstado(), antes);
  solicitudes[1].resolve([{ id: 102, total: 200 }]);
  await refresco;
  assert.equal(cargador.obtenerEstado().stats.totalVentas, 200);
  assert.equal(cargador.obtenerEstado().loading, false);
});

test('un refresco silencioso tras reactivar cierra el indicador que dejó el desmontaje', async () => {
  const { cargador, solicitudes } = preparar();
  const inicial = cargador.cambiarCafeteria(1);
  cargador.desmontar();
  solicitudes[0].resolve([{ id: 101 }]);
  await inicial;
  assert.equal(cargador.obtenerEstado().loading, true);

  cargador.activar();
  const refresco = cargador.refrescar(false);
  solicitudes[1].resolve([{ id: 102, total: 200 }]);
  await refresco;
  assert.equal(cargador.obtenerEstado().loading, false);
  assert.equal(cargador.obtenerEstado().pedidos[0].id, 102);
});

test('el reintento visible abre la carga y elimina el error anterior', async () => {
  const { cargador, solicitudes } = preparar();
  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].reject(new Error('Sin conexión'));
  await inicial;
  const reintento = cargador.refrescar(true);
  assert.equal(cargador.obtenerEstado().loading, true);
  assert.equal(cargador.obtenerEstado().dbError, null);
  solicitudes[1].resolve([{ id: 101, total: 100 }]);
  await reintento;
  assert.equal(cargador.obtenerEstado().loading, false);
  assert.equal(cargador.obtenerEstado().stats.totalVentas, 100);
});

for (const falla of [false, true]) {
  test(`cambio de cafetería descarta cálculos antiguos que ${falla ? 'fallan' : 'resuelven'} tarde`, async () => {
    const calculo = diferida();
    let calculos = 0;
    const { cargador, solicitudes, estados } = preparar({
      getEstadisticas: pedidos => {
        calculos++;
        return pedidos[0].id === 101 ? calculo.promise : Promise.resolve({ totalVentas: 500 });
      },
    });
    const inicial = cargador.cambiarCafeteria(1);
    solicitudes[0].resolve([{ id: 101, total: 9999 }]);
    await Promise.resolve();
    assert.equal(calculos, 1, 'La primera carga ya está calculando indicadores');
    const nueva = cargador.cambiarCafeteria(2);
    solicitudes[1].resolve([{ id: 201, total: 500 }]);
    await nueva;
    const vigente = cargador.obtenerEstado();
    const antes = estados.length;
    if (falla) calculo.reject(new Error('Cálculo antiguo fallido'));
    else calculo.resolve({ totalVentas: 9999 });
    await inicial;
    assert.equal(estados.length, antes);
    assert.deepEqual(cargador.obtenerEstado(), vigente);
    assert.equal(vigente.cafeteriaId, '2');
  });
}

for (const falla of [false, true]) {
  test(`desmontar y reactivar impide que una solicitud anterior ${falla ? 'fallida' : 'exitosa'} publique estado`, async () => {
    const { cargador, solicitudes, estados } = preparar();
    const inicial = cargador.cambiarCafeteria(1);
    cargador.desmontar();
    const antes = estados.length;
    if (falla) solicitudes[0].reject(new Error('Petición desmontada'));
    else solicitudes[0].resolve([{ id: 101 }]);
    await inicial;
    assert.equal(estados.length, antes);
    cargador.activar();
    const nueva = cargador.cambiarCafeteria(1);
    solicitudes[1].resolve([{ id: 102, total: 200 }]);
    await nueva;
    assert.equal(cargador.obtenerEstado().pedidos[0].id, 102);
    assert.equal(cargador.obtenerEstado().loading, false);
  });
}

test('reactivar con una petición antigua pendiente no permite publicar ni cerrar la nueva carga', async () => {
  const { cargador, solicitudes, estados } = preparar();
  const inicial = cargador.cambiarCafeteria(1);
  cargador.desmontar();
  cargador.activar();
  const nueva = cargador.cambiarCafeteria(1);
  const antes = estados.length;
  solicitudes[0].resolve([{ id: 101, total: 9999 }]);
  await inicial;
  assert.equal(estados.length, antes);
  assert.equal(cargador.obtenerEstado().loading, true);
  assert.deepEqual(cargador.obtenerEstado().pedidos, []);
  solicitudes[1].resolve([{ id: 102, total: 200 }]);
  await nueva;
  assert.equal(cargador.obtenerEstado().pedidos[0].id, 102);
  assert.equal(cargador.obtenerEstado().loading, false);
});

// Render real con ReactDOMServer. Se reemplazan únicamente los componentes
// visuales y las conexiones externas; VistaDashboard decide qué datos mostrar.
const bloque = etiqueta => ({ children }) => React.createElement(etiqueta, null, children);
const indicador = nombre => props => React.createElement('pre', { 'data-indicador': nombre }, JSON.stringify(props));
const { VistaDashboard } = cargar('pages/dueno/Dashboard.jsx', {
  '@mui/material': {
    Box: bloque('div'), Grid: bloque('div'),
    Alert: props => React.createElement('aside', null, props.children, props.action),
    Button: bloque('button'), Typography: bloque('span'),
    LinearProgress: () => React.createElement('progress'),
  },
  '../../services/supabaseClient': { isSupabaseConfigured: false },
  '../../services/pedidosService': {},
  '../../services/resumenComisiones': { obtener: async () => ({}) },
  '../../services/cargadorDashboard': cargadores,
  '../../components/dashboard/KpiCards': indicador('kpi'),
  '../../components/dashboard/ResumenComisiones': indicador('comisiones'),
  '../../components/dashboard/SalesChart': indicador('ventas'),
  '../../components/dashboard/OrdersDistributionChart': indicador('distribucion'),
  '../../components/dashboard/TopProductsChart': indicador('productos'),
  '../../components/dashboard/RecentOrdersTable': indicador('pedidos'),
});
const renderizar = (cafeteriaId, estado) => renderToStaticMarkup(
  React.createElement(VistaDashboard, { cafeteriaId, estado, onReintentar() {} })
);

for (const destino of [2, null]) {
  test(`primer render hacia ${destino === null ? 'usuario sin cafetería' : 'cafetería B'} oculta los datos ya visibles de A`, async () => {
    const { cargador, solicitudes } = preparar();
    const inicial = cargador.cambiarCafeteria(1);
    solicitudes[0].resolve([{ id: 'PEDIDO_A', nombre: 'PRODUCTO_A', total: 9876 }]);
    await inicial;
    const estadoA = cargador.obtenerEstado();
    assert.match(renderizar(1, estadoA), /PEDIDO_A/);
    assert.match(renderizar('1', estadoA), /9876/);

    // Todavía NO se llamó cambiarCafeteria: representa el render anterior al efecto.
    const primerRender = renderizar(destino, estadoA);
    assert.match(primerRender, /<progress/);
    assert.doesNotMatch(primerRender, /PEDIDO_A|PRODUCTO_A|9876|data-indicador|Última actualización/);
    const errorAnterior = { ...estadoA, dbError: 'ERROR_A' };
    assert.doesNotMatch(renderizar(destino, errorAnterior), /ERROR_A/);

    const nueva = cargador.cambiarCafeteria(destino);
    assert.equal(cargador.obtenerEstado().ultimaActualizacionExitosa, null);
    if (destino === null) {
      assert.equal(solicitudes.length, 1, 'No consultar pedidos sin cafetería');
      cargador.refrescar();
      assert.equal(solicitudes.length, 1);
      const html = renderizar(null, cargador.obtenerEstado());
      assert.match(html, /no tiene una cafetería autorizada/);
      assert.doesNotMatch(html, /<progress|data-indicador|PEDIDO_A/);
    } else {
      solicitudes[1].resolve([{ id: 'PEDIDO_B', nombre: 'PRODUCTO_B', total: 500 }]);
      await nueva;
      const html = renderizar(destino, cargador.obtenerEstado());
      assert.match(html, /PEDIDO_B/);
      assert.match(html, /Última actualización/);
      assert.doesNotMatch(html, /PEDIDO_A|PRODUCTO_A|9876|<progress/);
    }
  });
}

test('el aviso de comisiones no oculta las ventas ni el resumen ya obtenido', () => {
  const estado = {
    cafeteriaId: '1',
    stats: { totalVentas: 900, totalPedidos: 1 },
    pedidos: [{ id: 'PEDIDO_E11' }],
    salesData: [],
    topProducts: [],
    resumenComisiones: { ventasReferidas: 1, totalCobrado: 900,
      comisiones: { pendiente: 90, disponible: 0, revertida: 0 }, movimientos: [] },
    loading: false,
    dbError: null,
    comisionesError: 'No se pudieron consultar las comisiones.',
    ultimaActualizacionExitosa: '2026-11-23T04:00:00.000Z',
  };
  const html = renderizar(1, estado);
  assert.match(html, /No se pudieron consultar las comisiones/);
  assert.match(html, /Reintentar/);
  assert.match(html, /PEDIDO_E11/);
  assert.match(html, /data-indicador="comisiones"/);
  assert.match(html, /900/);
  assert.doesNotMatch(html, /progress/);
});

test('el componente real muestra el cotejo de ventas, cobro y comisiones con los datos de prueba', () => {
  const ResumenComisiones = cargar('components/dashboard/ResumenComisiones.jsx', {
    '@mui/material': { Grid: bloque('div'), Typography: bloque('span') },
    '../ui/BaseCard': { __esModule: true, default: bloque('section') },
    '../ui/BaseTable': {
      BaseTableContainer: bloque('div'), BaseTable: bloque('table'),
      BaseTableHead: bloque('thead'), BaseTableBody: bloque('tbody'),
      BaseTableRow: bloque('tr'), BaseTableCell: bloque('td'),
    },
    '../../design/tokens': {
      COLORS: { textPrimary: '#000', textMuted: '#666' },
      SPACING: { xxl: 24, md: 8, lg: 16 },
      TYPOGRAPHY: { fontWeightBold: 700, fontWeightExtraBold: 800 },
    },
  }).default;
  const resumen = {
    ventasReferidas: 3,
    totalCobrado: 37000,
    comisiones: { pendiente: 0, disponible: 2000, revertida: 2500 },
    reversiones: -2500,
    movimientos: [
      { id: 6, pedidoId: 12, tipo: 'reversion', estado: 'revertida', montoClp: -1500, creadoEn: '2026-11-23T04:30:00Z' },
      { id: 2, pedidoId: 10, tipo: 'reversion', estado: 'revertida', montoClp: -1000, creadoEn: '2026-11-23T02:00:00Z' },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(ResumenComisiones, { resumen }));
  for (const texto of [
    'Ventas referidas', '3', 'Total cobrado', '$37.000',
    'Comisión pendiente', '$0', 'Comisión disponible', '$2.000',
    'Comisión revertida', '$2.500', 'Reversiones', '$-2.500', '#10', '#12',
  ]) {
    assert.ok(html.includes(texto), `Falta ${texto} en el resumen renderizado`);
  }
});
