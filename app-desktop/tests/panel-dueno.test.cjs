const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

// Ejecutar servicios reales con un transporte Supabase en memoria; sin Cloud.
function cargar(archivo, nombre, dependencias) {
  const ruta = path.join(__dirname, '../src/services', archivo);
  const codigo = transformSync(fs.readFileSync(ruta, 'utf8'), {
    format: 'cjs', sourcefile: ruta, target: 'node22',
  }).code;
  const modulo = { exports: {} };
  const importar = specifier => {
    // Verifica que cada import exista. Solo se sustituye el límite externo.
    const destino = path.resolve(path.dirname(ruta), specifier);
    assert.ok(fs.existsSync(destino) || fs.existsSync(destino + '.js'), `Import inexistente: ${specifier}`);
    const nombres = {
      './supabase': ['supabase', 'isSupabaseConfigured'],
      './supabase.js': ['supabase', 'isSupabaseConfigured'],
      './supabaseClient': ['supabase', 'isSupabaseConfigured'],
      './usuarios.js': ['usuarios'], './backendApi': ['backendApi', 'CAFETERIA_ID'],
      '../utils/dateUtils': ['parsearFecha', 'formatearHora', 'formatearHoraBucket'],
      './pedidosService': ['pedidosService'],
    }[specifier];
    assert.ok(nombres, `Dependencia sin definir: ${specifier}`);
    return Object.fromEntries(nombres.map(k => [k, dependencias[k]]));
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  assert.ok(modulo.exports[nombre], `Export inexistente: ${nombre}`);
  return modulo.exports[nombre];
}

function transporte(filas) {
  let fallo = null;
  return {
    fallar(error) { fallo = error; },
    from() {
      const filtros = [];
      let cambios;
      let unica = false;
      const q = {
        update(v) { cambios = v; return q; },
        eq(k, v) { filtros.push([k, v]); return q; },
        select() { return q; },
        single() { unica = true; return q; },
        maybeSingle() { unica = true; return q; },
        then(resolve) {
          if (fallo) return Promise.resolve({ data: null, error: fallo }).then(resolve);
          const seleccion = filas.filter(f => filtros.every(([k,v]) => String(f[k]) === String(v)));
          seleccion.forEach(f => Object.assign(f, cambios));
          return Promise.resolve({ data: unica ? seleccion[0] ?? null : seleccion,
            error: unica && !seleccion.length && cambios?.stock !== undefined ? { code: 'PGRST116' } : null }).then(resolve);
        },
      };
      return q;
    },
  };
}

for (const estado of ['aprobado', 'rechazado']) {
  test('resolver pendiente como ' + estado + ' persiste y no permite segunda resolución', async () => {
    const filas = [{ id: 7, cafeteria_id: 2, estado: 'pendiente' }];
    const supabase = transporte(filas);
    const servicio = cargar('solicitudes_stock.js', 'solicitudesStock', { supabase });
    await servicio.resolverSolicitud({ id: 7, cafeteriaId: 2, usuarioId: 9, estado });
    assert.equal(filas[0].estado, estado);
    assert.equal(filas[0].usuario_responde_id, 9);
    assert.ok(filas[0].fecha_respuesta);
    await assert.rejects(() => servicio.resolverSolicitud({ id: 7, cafeteriaId: 2, usuarioId: 9, estado }));
  });
}
test('error Supabase y cafetería ajena no producen resolución exitosa', async () => {
  const filas = [{ id: 7, cafeteria_id: 2, estado: 'pendiente' }];
  const supabase = transporte(filas);
  const servicio = cargar('solicitudes_stock.js', 'solicitudesStock', { supabase });
  await assert.rejects(() => servicio.resolverSolicitud({ id: 7, cafeteriaId: 3, usuarioId: 9, estado: 'aprobado' }));
  supabase.fallar(new Error('Permiso denegado'));
  await assert.rejects(() => servicio.resolverSolicitud({ id: 7, cafeteriaId: 2, usuarioId: 9, estado: 'aprobado' }));
  assert.equal(filas[0].estado, 'pendiente');
});
function productos(filas, cafeteriaId = 2) {
  const supabase = transporte(filas);
  return { supabase, servicio: cargar('productos.js', 'productos', { supabase,
    isSupabaseConfigured: true, usuarios: { getPerfilSesion: async () => ({ success: true,
      rol: 'dueño', user: { cafeteria_id: cafeteriaId } }) } }) };
}
test('cancelación no hace UPDATE directo si el backend falla', async () => {
  let accesosDirectos = 0;
  const servicio = cargar('pedidosService.js', 'pedidosService', {
    supabase: { from() { accesosDirectos++; throw new Error('UPDATE directo prohibido'); } },
    isSupabaseConfigured: true, CAFETERIA_ID: null,
    backendApi: { cambiarEstadoPedido: async () => { throw new Error('Backend no disponible'); } },
    parsearFecha: v => new Date(v), formatearHora: () => '', formatearHoraBucket: () => '',
  });
  servicio.getById = async () => ({ id: 1, estado: 'pendiente' });
  await assert.rejects(() => servicio.updateEstado(1, 'cancelado'), /Backend no disponible/);
  assert.equal(accesosDirectos, 0);
});
test('stock manual aumenta y disminuye persistiendo el valor del transporte', async () => {
  const filas = [{ id: 5, cafeteria_id: 2, stock: 8 }];
  const { servicio } = productos(filas);
  assert.equal((await servicio.updateStock(5, 13, 2, 8)).stock, 13);
  assert.equal((await servicio.getById(5)).stock, 13);
  await servicio.updateStock(5, 10, 2, 13);
  assert.equal((await servicio.getById(5)).stock, 10);
});
test('stock concurrente, negativo y producto ajeno son rechazados', async () => {
  const filas = [{ id: 5, cafeteria_id: 2, stock: 8 }];
  const { servicio } = productos(filas);
  await assert.rejects(() => servicio.updateStock(5, 13, 2, 10));
  await assert.rejects(() => servicio.updateStock(5, -1, 2, 8));
  const ajeno = productos(filas, 3).servicio;
  await assert.rejects(() => ajeno.updateStock(5, 13, 2, 8));
  assert.equal(filas[0].stock, 8);
});
test('Dashboard incluye históricos en indicadores; solo ventas por hora filtra hoy', async () => {
  const servicio = cargar('pedidosService.js', 'pedidosService', { supabase: {}, isSupabaseConfigured: true,
    backendApi: {}, CAFETERIA_ID: null, parsearFecha: v => v ? new Date(v) : null,
    formatearHora: () => '', formatearHoraBucket: v => String(new Date(v).getHours()).padStart(2,'0') + ':00' });
  const hoy = new Date().toISOString();
  const filas = [
    { estado: 'pendiente', pago_estado: 'pagado', total: 300, creado_en: hoy, productos: [{ nombre: 'Café', cantidad: 3 }] },
    { estado: 'pendiente', pago_estado: 'pendiente', total: 200, creado_en: hoy },
    { estado: 'cancelado', pago_estado: 'pagado', total: 100, creado_en: hoy },
    { estado: 'entregado', total: 900, creado_en: '2000-01-01T12:00:00Z' },
    { estado: 'pendiente', pago_estado: 'pagado', total: 100, creado_en: '2000-01-01T12:00:00Z' },
    { estado: 'listo', total: 200, creado_en: '2000-01-01T12:00:00Z', productos: [{ nombre: 'Café', cantidad: 2 }] },
  ];
  const stats = await servicio.getEstadisticas(filas);
  assert.equal(stats.totalVentas, 1500);
  assert.equal(stats.totalPedidos, 6);
  assert.equal(stats.pendientes, 3);
  assert.equal(stats.listos, 1);
  assert.equal(stats.entregados, 1);
  assert.equal((await servicio.getTopProductos(filas))[0].cantidad, 5);
  assert.equal((await servicio.getVentasPorHora(filas)).reduce((s,h) => s+h.ventas, 0), 300);
  assert.equal((await servicio.getEstadisticas([])).totalVentas, 0);
});

test('Dashboard: cambio de cafetería y desmontaje invalidan cargas pendientes y descartan respuestas invertidas (S3-T2)', async () => {
  const deferidos = {};
  const llamadas = [];

  const pedidosServiceMock = {
    getAll: ({ cafeteriaId }) => {
      llamadas.push(cafeteriaId);
      return new Promise((resolve, reject) => {
        deferidos[cafeteriaId] = { resolve, reject };
      });
    },
    getEstadisticas: async (pedidos) => ({
      totalVentas: pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0),
      totalPedidos: pedidos.length,
      pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    }),
    getVentasPorHora: async () => [{ hora: '12:00', ventas: 100 }],
    getTopProductos: async () => [{ nombre: 'Café', cantidad: 5 }],
  };

  const estadosNotificados = [];
  const crearCargador = cargar('cargadorDashboard.js', 'crearCargadorDashboard', {
    pedidosService: pedidosServiceMock,
  });

  const cargador = crearCargador({
    pedidosService: pedidosServiceMock,
    onEstadoCambiado: (e) => estadosNotificados.push(e),
    obtenerFechaActual: () => '2026-11-12T12:00:00.000Z',
  });

  // 1. Inicia carga para Cafetería 1
  const promesaA = cargador.cambiarCafeteria(1);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0], '1');

  // Verificación: al cambiar a Cafetería 1, loading es true y los indicadores parten limpios
  const estadoInicialA = cargador.obtenerEstado();
  assert.equal(estadoInicialA.loading, true);
  assert.equal(estadoInicialA.stats, null);
  assert.deepEqual(estadoInicialA.pedidos, []);

  // 2. Antes de que resuelva Cafetería 1, el usuario cambia a Cafetería 2
  const promesaB = cargador.cambiarCafeteria(2);
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1], '2');

  // Criterio: "no muestra indicadores del contexto anterior"
  // El cambio de cafetería debe limpiar de inmediato los indicadores anteriores
  const estadoAlCambiarB = cargador.obtenerEstado();
  assert.equal(estadoAlCambiarB.loading, true);
  assert.equal(estadoAlCambiarB.stats, null);
  assert.deepEqual(estadoAlCambiarB.pedidos, []);
  assert.equal(estadoAlCambiarB.ultimaActualizacionExitosa, null);

  // 3. Criterio: "Prueba con respuestas invertidas"
  // Cafetería 2 (la más reciente) responde primero (out-of-order)
  const datosB = [{ id: 201, cafeteria_id: 2, total: 500, estado: 'entregado' }];
  deferidos[2].resolve(datosB);
  await promesaB;

  const estadoPostB = cargador.obtenerEstado();
  assert.equal(estadoPostB.loading, false);
  assert.equal(estadoPostB.stats.totalVentas, 500);
  assert.equal(estadoPostB.pedidos[0].id, 201);
  assert.equal(estadoPostB.ultimaActualizacionExitosa, '2026-11-12T12:00:00.000Z');

  // Ahora responde tardíamente la petición antigua de Cafetería 1 (respuesta invertida)
  const datosA = [{ id: 101, cafeteria_id: 1, total: 9999, estado: 'entregado' }];
  deferidos[1].resolve(datosA);
  await promesaA;

  // Criterio: La respuesta antigua de Cafetería 1 DEBE descartarse y NO sobreescribir Cafetería 2
  const estadoFinal = cargador.obtenerEstado();
  assert.equal(estadoFinal.stats.totalVentas, 500, 'La respuesta invertida de Cafetería 1 no debe sobreescribir');
  assert.equal(estadoFinal.pedidos[0].id, 201, 'Los pedidos deben permanecer los de Cafetería 2');

  // 4. Criterio: "desmontaje invalida cargas pendientes"
  const promesaC = cargador.cambiarCafeteria(3);
  assert.equal(cargador.obtenerEstado().loading, true);

  // Se desmonta el componente antes de que la carga pendiente resuelva
  cargador.desmontar();

  const numEstadosAntes = estadosNotificados.length;
  // Resuelve la petición de Cafetería 3 tras desmontar
  deferidos[3].resolve([{ id: 301, cafeteria_id: 3, total: 100 }]);
  await promesaC;

  // No debe haberse emitido ningún estado tras el desmontaje
  assert.equal(estadosNotificados.length, numEstadosAntes, 'No se deben emitir estados tras el desmontaje');
});
