// Pruebas del resumen de comisiones y de su integración con el cargador del dashboard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

function cargar(archivo, nombre, dependencias) {
  const ruta = path.join(__dirname, '../src/services', archivo);
  const codigo = transformSync(fs.readFileSync(ruta, 'utf8'), {
    format: 'cjs', sourcefile: ruta, target: 'node22',
  }).code;
  const modulo = { exports: {} };
  const importar = specifier => {
    assert.ok(Object.hasOwn(dependencias, specifier), `Import sin definir: ${specifier}`);
    return dependencias[specifier];
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  assert.ok(modulo.exports[nombre], `Export inexistente: ${nombre}`);
  return modulo.exports[nombre];
}

const construirResumen = cargar('resumenComisiones.js', 'construirResumen', {
  './supabaseClient': { supabase: {} },
});
const obtenerResumen = cargar('resumenComisiones.js', 'obtenerResumenComisiones', {
  './supabaseClient': { supabase: {} },
});
const cargadores = cargar('cargadorDashboard.js', 'crearCargadorDashboard', {
  './pedidosService': {},
  './resumenComisiones': { resumenComisiones: { obtener: async () => ({}) } },
});

function transporte(filas) {
  let fallo = null;
  const supabase = {
    fallar(error) { fallo = error; },
    from(tabla) {
      assert.equal(tabla, 'movimientos_comision');
      const q = {
        select() { return q; },
        order() { return q; },
        then(resolve, reject) {
          if (fallo) return Promise.reject(fallo).then(resolve, reject);
          return Promise.resolve({ data: filas.map(fila => ({ ...fila })), error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return supabase;
}

function diferida() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function prepararCargador(obtener) {
  const solicitudes = [];
  const estados = [];
  const servicio = {
    getAll({ cafeteriaId }) {
      const solicitud = { ...diferida(), cafeteriaId };
      solicitudes.push(solicitud);
      return solicitud.promise;
    },
    getEstadisticas: async pedidos => ({ totalVentas: pedidos[0]?.total || 0, totalPedidos: pedidos.length }),
    getVentasPorHora: async () => [],
    getTopProductos: async () => [],
  };
  const cargador = cargadores({
    pedidosService: servicio,
    resumenComisiones: { obtener },
    onEstadoCambiado: estado => estados.push(estado),
  });
  return { cargador, solicitudes, estados };
}

test('sin cafetería el resumen es vacío y no consulta Supabase', async () => {
  const supabase = { from() { throw new Error('No debió consultar'); } };
  for (const cafeteriaId of [null, undefined, '', '  ']) {
    assert.deepEqual(await obtenerResumen(cafeteriaId, supabase), {
      ventasReferidas: 0,
      totalCobrado: 0,
      comisiones: { pendiente: 0, disponible: 0, revertida: 0 },
      reversiones: 0,
      movimientos: [],
    });
  }
});

test('el resumen agrupa por estado, cuenta cada venta una vez y no resta dos veces la reversión', () => {
  const filas = [
    { id: 1, pedido_id: 10, tipo: 'comision', estado: 'pendiente', monto_clp: 1000, creado_en: '2026-11-23T01:00:00Z', pedidos: { cafeteria_id: 1, total: 10000 } },
    { id: 2, pedido_id: 10, tipo: 'reversion', estado: 'revertida', monto_clp: -1000, creado_en: '2026-11-23T02:00:00Z', pedidos: { cafeteria_id: 1, total: 10000 } },
    { id: 3, pedido_id: 11, tipo: 'comision', estado: 'disponible', monto_clp: 2000, creado_en: '2026-11-23T03:00:00Z', pedidos: { cafeteria_id: 1, total: 15000 } },
    { id: 4, pedido_id: 12, tipo: 'comision', estado: 'revertida', monto_clp: 1500, creado_en: '2026-11-23T04:00:00Z', pedidos: { cafeteria_id: 1, total: 12000 } },
    { id: 5, pedido_id: 13, tipo: 'comision', estado: 'pendiente', monto_clp: 9999, creado_en: '2026-11-23T05:00:00Z', pedidos: { cafeteria_id: 2, total: 99999 } },
  ];
  const resumen = construirResumen(filas, 1);
  assert.equal(resumen.ventasReferidas, 3);
  assert.equal(resumen.totalCobrado, 37000);
  assert.deepEqual(resumen.comisiones, { pendiente: 1000, disponible: 2000, revertida: 1500 });
  assert.equal(resumen.reversiones, -1000);
  assert.deepEqual(resumen.movimientos.map(m => m.id), [4, 3, 2, 1]);
});

test('un error de Supabase se propaga como error de comisiones', async () => {
  const supabase = transporte([]);
  supabase.fallar(new Error('Permiso denegado'));
  await assert.rejects(() => obtenerResumen(1, supabase), /Permiso denegado/);
});

test('una cafetería ajena no aporta movimientos aunque RLS los devuelva', () => {
  const filas = [
    { id: 1, pedido_id: 10, tipo: 'comision', estado: 'pendiente', monto_clp: 500, pedidos: { cafeteria_id: 2, total: 5000 } },
    { id: 2, pedido_id: 11, tipo: 'comision', estado: 'disponible', monto_clp: 700, pedidos: { cafeteria_id: 1, total: 7000 } },
  ];
  const resumen = construirResumen(filas, 1);
  assert.equal(resumen.ventasReferidas, 1);
  assert.equal(resumen.totalCobrado, 7000);
  assert.equal(resumen.comisiones.pendiente, 0);
  assert.equal(resumen.comisiones.disponible, 700);
  assert.equal(resumen.movimientos.length, 1);
});

test('un fallo de comisiones deja las ventas visibles y el reintento recupera el resumen', async () => {
  const resumen = { ventasReferidas: 1, comisiones: { pendiente: 50 } };
  const { cargador, solicitudes } = prepararCargador(() => Promise.reject(new Error('Sin comisiones')));
  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 10, total: 900 }]);
  await inicial;
  let estado = cargador.obtenerEstado();
  assert.equal(estado.dbError, null);
  assert.equal(estado.stats.totalVentas, 900);
  assert.equal(estado.comisionesError, 'Sin comisiones');
  assert.equal(estado.resumenComisiones, null);

  const { cargador: reintento, solicitudes: nuevas } = prepararCargador(() => Promise.resolve(resumen));
  const carga = reintento.cambiarCafeteria(1);
  nuevas[0].resolve([{ id: 10, total: 900 }]);
  await carga;
  estado = reintento.obtenerEstado();
  assert.equal(estado.comisionesError, null);
  assert.deepEqual(estado.resumenComisiones, resumen);
  assert.equal(estado.stats.totalVentas, 900);
});

test('el reintento visible limpia el aviso anterior antes de volver a consultar', async () => {
  let llamadas = 0;
  const { cargador, solicitudes } = prepararCargador(() => {
    llamadas++;
    return llamadas === 1 ? Promise.reject(new Error('Sin comisiones')) : Promise.resolve({ ventasReferidas: 2 });
  });
  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 10, total: 900 }]);
  await inicial;
  const reintento = cargador.refrescar(true);
  assert.equal(cargador.obtenerEstado().comisionesError, null);
  solicitudes[1].resolve([{ id: 10, total: 900 }]);
  await reintento;
  assert.equal(cargador.obtenerEstado().comisionesError, null);
  assert.deepEqual(cargador.obtenerEstado().resumenComisiones, { ventasReferidas: 2 });
});

test('un cambio de cafetería descarta el resumen tardío de la anterior', async () => {
  const viejo = diferida();
  const { cargador, solicitudes } = prepararCargador(caf => caf === '1' ? viejo.promise : Promise.resolve({ ventasReferidas: 7 }));
  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 10, total: 100 }]);
  await Promise.resolve();
  const nueva = cargador.cambiarCafeteria(2);
  solicitudes[1].resolve([{ id: 20, total: 200 }]);
  await nueva;
  const vigente = cargador.obtenerEstado();
  assert.deepEqual(vigente.resumenComisiones, { ventasReferidas: 7 });
  viejo.resolve({ ventasReferidas: 999 });
  await inicial;
  assert.deepEqual(cargador.obtenerEstado(), vigente);
});
