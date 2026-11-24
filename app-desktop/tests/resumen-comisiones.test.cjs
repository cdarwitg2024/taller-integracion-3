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

function transporte(filas, opciones = {}) {
  const consultas = [];
  let fallo = opciones.fallo || null;
  let pagina = 0;
  const supabase = {
    consultas,
    fallar(error) { fallo = error; },
    from(tabla) {
      assert.equal(tabla, 'movimientos_comision');
      let desde = 0;
      let hasta = null;
      const q = {
        select(campos, opcionesSelect) {
          consultas.push({ metodo: 'select', campos, opciones: opcionesSelect });
          return q;
        },
        eq(columna, valor) { consultas.push({ metodo: 'eq', columna, valor }); return q; },
        order(columna, opcionesOrden) {
          consultas.push({ metodo: 'order', columna, opciones: opcionesOrden });
          return q;
        },
        range(inicio, fin) { desde = inicio; hasta = fin; consultas.push({ metodo: 'range', inicio, fin }); return q; },
        then(resolve, reject) {
          if (fallo) return Promise.reject(fallo).then(resolve, reject);
          const total = Array.isArray(opciones.conteo) ? opciones.conteo[pagina] : (opciones.conteo ?? filas.length);
          pagina++;
          const datos = filas.slice(desde, hasta === null ? undefined : hasta + 1);
          return Promise.resolve({
            data: datos.map(fila => ({ ...fila })), count: total, error: null,
          }).then(resolve, reject);
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
    { id: 1, pedido_id: 10, tipo: 'comision', estado: 'revertida', monto_clp: 1000, creado_en: '2026-11-23T01:00:00Z', pedidos: { cafeteria_id: 1, total: 10000 } },
    { id: 2, pedido_id: 10, tipo: 'reversion', estado: 'revertida', monto_clp: -1000, creado_en: '2026-11-23T02:00:00Z', pedidos: { cafeteria_id: 1, total: 10000 } },
    { id: 3, pedido_id: 11, tipo: 'comision', estado: 'disponible', monto_clp: 2000, creado_en: '2026-11-23T03:00:00Z', pedidos: { cafeteria_id: 1, total: 15000 } },
    { id: 4, pedido_id: 12, tipo: 'comision', estado: 'revertida', monto_clp: 1500, creado_en: '2026-11-23T04:00:00Z', pedidos: { cafeteria_id: 1, total: 12000 } },
    { id: 6, pedido_id: 12, tipo: 'reversion', estado: 'revertida', monto_clp: -1500, creado_en: '2026-11-23T04:30:00Z', pedidos: { cafeteria_id: 1, total: 12000 } },
    { id: 5, pedido_id: 13, tipo: 'comision', estado: 'pendiente', monto_clp: 9999, creado_en: '2026-11-23T05:00:00Z', pedidos: { cafeteria_id: 2, total: 99999 } },
  ];
  const resumen = construirResumen(filas, 1);
  assert.equal(resumen.ventasReferidas, 3);
  assert.equal(resumen.totalCobrado, 37000);
  assert.deepEqual(resumen.comisiones, { pendiente: 0, disponible: 2000, revertida: 2500 });
  assert.equal(resumen.reversiones, -2500);
  assert.deepEqual(resumen.movimientos.map(m => m.id), [6, 4, 3, 2, 1]);
});

test('un error de Supabase se propaga como error de comisiones', async () => {
  const supabase = transporte([]);
  supabase.fallar(new Error('Permiso denegado'));
  await assert.rejects(() => obtenerResumen(1, supabase), /Permiso denegado/);
});

function filasGeneradas(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    id: indice + 1,
    pedido_id: indice + 1,
    tipo: 'comision',
    estado: 'pendiente',
    monto_clp: 100,
    creado_en: `2026-11-23T${String(indice % 24).padStart(2, '0')}:00:00Z`,
    pedidos: { cafeteria_id: 1, total: 1000 },
  }));
}

test('la consulta filtra por cafetería en servidor y pagina el historial completo', async () => {
  const supabase = transporte(filasGeneradas(450));
  const resumen = await obtenerResumen('1', supabase);
  assert.equal(resumen.ventasReferidas, 450);
  assert.equal(resumen.totalCobrado, 450000);
  assert.equal(resumen.comisiones.pendiente, 45000);
  assert.deepEqual(supabase.consultas.find(c => c.metodo === 'eq'), {
    metodo: 'eq', columna: 'pedidos.cafeteria_id', valor: '1',
  });
  assert.deepEqual(supabase.consultas.find(c => c.metodo === 'select').opciones, { count: 'exact' });
  assert.equal(supabase.consultas.filter(c => c.metodo === 'range').length, 3);
});

test('un historial incompleto se rechaza en vez de mostrar cifras parciales', async () => {
  const supabase = transporte(filasGeneradas(1), { conteo: 2 });
  await assert.rejects(() => obtenerResumen(1, supabase), /historial completo/);
});

test('un cambio de total entre páginas se rechaza', async () => {
  const supabase = transporte(filasGeneradas(250), { conteo: [250, 251] });
  await assert.rejects(() => obtenerResumen(1, supabase), /historial completo/);
});

test('un historial mayor que 50 páginas se rechaza sin cifras parciales', async () => {
  const supabase = transporte(filasGeneradas(200 * 50 + 1));
  await assert.rejects(() => obtenerResumen(1, supabase), /demasiado extenso/);
  assert.equal(supabase.consultas.filter(c => c.metodo === 'range').length, 50);
});

test('ids duplicados o no enteros se rechazan', async () => {
  const duplicados = filasGeneradas(2);
  duplicados[1].id = duplicados[0].id;
  await assert.rejects(() => obtenerResumen(1, transporte(duplicados)), /no es válida/);
  const noEntero = filasGeneradas(1);
  noEntero[0].id = '1';
  await assert.rejects(() => obtenerResumen(1, transporte(noEntero)), /no es válida/);
});

test('un historial vacío con cafetería válida devuelve el resumen vacío', async () => {
  const supabase = transporte([]);
  const resumen = await obtenerResumen(7, supabase);
  assert.deepEqual(resumen, {
    ventasReferidas: 0,
    totalCobrado: 0,
    comisiones: { pendiente: 0, disponible: 0, revertida: 0 },
    reversiones: 0,
    movimientos: [],
  });
  assert.equal(supabase.consultas.filter(c => c.metodo === 'range').length, 1);
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

test('un refresco fallido conserva aviso, resumen previo y ventas hasta el reintento', async () => {
  const bueno = { ventasReferidas: 3, comisiones: { pendiente: 300 } };
  const nuevo = { ventasReferidas: 4, comisiones: { pendiente: 400 } };
  let llamadas = 0;
  const { cargador, solicitudes } = prepararCargador(() => {
    llamadas++;
    if (llamadas === 2) return Promise.reject(new Error('Caída transitoria'));
    return Promise.resolve(llamadas === 3 ? nuevo : bueno);
  });

  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 10, total: 900 }]);
  await inicial;
  assert.deepEqual(cargador.obtenerEstado().resumenComisiones, bueno);

  const refresco = cargador.refrescar(false);
  solicitudes[1].resolve([{ id: 10, total: 900 }]);
  await refresco;
  const conAviso = cargador.obtenerEstado();
  assert.equal(conAviso.comisionesError, 'Caída transitoria');
  assert.equal(conAviso.dbError, null);
  assert.equal(conAviso.stats.totalVentas, 900);
  assert.deepEqual(conAviso.resumenComisiones, bueno);

  const reintento = cargador.refrescar(true);
  assert.equal(cargador.obtenerEstado().comisionesError, null);
  solicitudes[2].resolve([{ id: 10, total: 900 }]);
  await reintento;
  const final = cargador.obtenerEstado();
  assert.equal(final.comisionesError, null);
  assert.deepEqual(final.resumenComisiones, nuevo);
  assert.equal(final.stats.totalVentas, 900);
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
  const tardio = diferida();
  const terceraLlamada = diferida();
  let cargasCafeteriaUno = 0;
  const obtener = cafeteria => {
    if (cafeteria === '2') return Promise.resolve({ ventasReferidas: 7 });
    cargasCafeteriaUno++;
    if (cargasCafeteriaUno === 1) return Promise.resolve({ ventasReferidas: 5 });
    if (cargasCafeteriaUno === 2) return Promise.reject(new Error('Sin comisiones'));
    terceraLlamada.resolve();
    return tardio.promise;
  };
  const { cargador, solicitudes } = prepararCargador(obtener);

  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([{ id: 10, total: 100 }]);
  await inicial;
  assert.equal(cargador.obtenerEstado().resumenComisiones.ventasReferidas, 5);

  const conError = cargador.refrescar(false);
  solicitudes[1].resolve([{ id: 11, total: 100 }]);
  await conError;
  assert.equal(cargador.obtenerEstado().resumenComisiones.ventasReferidas, 5);
  assert.equal(cargador.obtenerEstado().comisionesError, 'Sin comisiones');

  const refrescado = cargador.refrescar(false);
  solicitudes[2].resolve([{ id: 12, total: 100 }]);
  await terceraLlamada.promise;
  assert.equal(cargasCafeteriaUno, 3);
  const nueva = cargador.cambiarCafeteria(2);
  assert.equal(cargador.obtenerEstado().resumenComisiones, null);
  assert.equal(cargador.obtenerEstado().comisionesError, null);
  solicitudes[3].resolve([{ id: 20, total: 200 }]);
  await nueva;
  const vigente = cargador.obtenerEstado();
  assert.deepEqual(vigente.resumenComisiones, { ventasReferidas: 7 });
  tardio.resolve({ ventasReferidas: 999 });
  await refrescado;
  assert.deepEqual(cargador.obtenerEstado(), vigente);
});

test('los refrescos silenciosos no invalidan una carga más lenta que el respaldo', async () => {
  const resumen = diferida();
  const { cargador, solicitudes } = prepararCargador(() => resumen.promise);
  const inicial = cargador.cambiarCafeteria(1);
  for (let intento = 0; intento < 3; intento++) {
    assert.equal(cargador.refrescar(false), undefined);
  }
  assert.equal(solicitudes.length, 1);
  assert.equal(cargador.obtenerRequestId(), 1);

  solicitudes[0].resolve([{ id: 10, total: 900 }]);
  resumen.resolve({ ventasReferidas: 1, totalCobrado: 900, comisiones: { pendiente: 90 } });
  await inicial;

  const estado = cargador.obtenerEstado();
  assert.equal(estado.loading, false);
  assert.equal(estado.dbError, null);
  assert.equal(estado.comisionesError, null);
  assert.equal(estado.stats.totalVentas, 900);
  assert.deepEqual(estado.resumenComisiones, {
    ventasReferidas: 1, totalCobrado: 900, comisiones: { pendiente: 90 },
  });

  const siguiente = cargador.refrescar(false);
  assert.equal(solicitudes.length, 2);
  solicitudes[1].resolve([{ id: 10, total: 900 }]);
  await siguiente;
  assert.equal(cargador.obtenerEstado().loading, false);
});

test('entrega y cancelación actualizan el resumen con el mismo refresco que usa Realtime', async () => {
  // V11 solo mueve comisiones pendientes a disponible y V09 solo revierte pendientes: son pedidos distintos.
  const comisionEntregada = { id: 1, pedido_id: 20, tipo: 'comision', monto_clp: 1000, creado_en: '2026-11-23T10:00:00Z', pedidos: { cafeteria_id: 1, total: 10000 } };
  const comisionCancelada = { id: 2, pedido_id: 21, tipo: 'comision', monto_clp: 500, creado_en: '2026-11-23T10:01:00Z', pedidos: { cafeteria_id: 1, total: 5000 } };
  const reversion = { id: 3, pedido_id: 21, tipo: 'reversion', estado: 'revertida', monto_clp: -500, creado_en: '2026-11-23T10:05:00Z', pedidos: { cafeteria_id: 1, total: 5000 } };
  const pendiente = [
    { ...comisionEntregada, estado: 'pendiente' },
    { ...comisionCancelada, estado: 'pendiente' },
  ];
  const entregado = [
    { ...comisionEntregada, estado: 'disponible' },
    pendiente[1],
  ];
  const cancelado = [
    entregado[0],
    { ...comisionCancelada, estado: 'revertida' },
    reversion,
  ];
  const instantaneas = [pendiente, entregado, cancelado].map(filas => construirResumen(filas, 1));
  let llamada = 0;
  const { cargador, solicitudes } = prepararCargador(() => Promise.resolve(instantaneas[llamada++]));

  const inicial = cargador.cambiarCafeteria(1);
  solicitudes[0].resolve([
    { id: 20, total: 10000, estado: 'listo' },
    { id: 21, total: 5000, estado: 'pagado' },
  ]);
  await inicial;
  assert.deepEqual(cargador.obtenerEstado().resumenComisiones, instantaneas[0]);
  assert.equal(cargador.obtenerEstado().resumenComisiones.comisiones.pendiente, 1500);

  const entrega = cargador.refrescar(false);
  solicitudes[1].resolve([
    { id: 20, total: 10000, estado: 'entregado' },
    { id: 21, total: 5000, estado: 'pagado' },
  ]);
  await entrega;
  const trasEntrega = cargador.obtenerEstado().resumenComisiones;
  assert.deepEqual(trasEntrega, instantaneas[1]);
  assert.equal(trasEntrega.comisiones.pendiente, 500);
  assert.equal(trasEntrega.comisiones.disponible, 1000);
  assert.equal(trasEntrega.comisiones.revertida, 0);

  const cancelacion = cargador.refrescar(false);
  solicitudes[2].resolve([
    { id: 20, total: 10000, estado: 'entregado' },
    { id: 21, total: 5000, estado: 'cancelado' },
  ]);
  await cancelacion;
  const trasCancelacion = cargador.obtenerEstado().resumenComisiones;
  assert.deepEqual(trasCancelacion, instantaneas[2]);
  assert.equal(trasCancelacion.comisiones.pendiente, 0);
  assert.equal(trasCancelacion.comisiones.disponible, 1000);
  assert.equal(trasCancelacion.comisiones.revertida, 500);
  assert.equal(trasCancelacion.reversiones, -500);
  assert.equal(trasCancelacion.ventasReferidas, 2);
  assert.equal(trasCancelacion.totalCobrado, 15000);
});
