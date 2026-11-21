// Prueba el acceso, el contexto y la gestión de solicitudes de afiliados (V01 / CAM-223, E10 / CAM-232).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { MemoryRouter, useLocation } = require('react-router-dom');

const src = path.resolve(__dirname, '../src');
const dueno = cafeteria_id => ({ id: 9, nombre: 'Dueño de prueba', roles: { nombre: 'dueño' }, cafeteria_id });
const mui = Object.fromEntries(('Box CssBaseline Drawer List ListItemButton ListItemIcon ListItemText Typography Badge Button Stack IconButton Alert Chip Paper TextField CircularProgress').split(' ')
  .map(nombre => [nombre, ({ children, action, ...props }) => React.createElement(nombre, props, children, action)]));

// Se ejecutan App, router, layout, sidebar y Afiliados reales. Se sustituyen
// únicamente servicios externos, presentación MUI y páginas de otras tareas.
function cargarApp(servicios) {
  const cache = new Map();
  function cargar(archivo) {
    if (cache.has(archivo)) return cache.get(archivo);
    const modulo = { exports: {} };
    const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
      format: 'cjs', loader: 'jsx', jsx: 'automatic', target: 'node22', sourcefile: archivo,
    }).code;
    const importar = nombre => {
      if (['react', 'react/jsx-runtime', 'react-router-dom'].includes(nombre)) return require(nombre);
      if (nombre === '@mui/material') return mui;
      if (nombre.startsWith('@mui/icons-material/')) {
        assert.doesNotThrow(() => require.resolve(nombre), `Icono inexistente: ${nombre}`);
        return () => React.createElement('icono');
      }
      assert.ok(nombre.startsWith('.'), `Import no definido: ${nombre}`);
      const base = path.resolve(path.dirname(archivo), nombre);
      const destino = [base, base + '.jsx', base + '.js'].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
      assert.ok(destino, `Import inexistente: ${nombre}`);
      const relativa = path.relative(src, destino).split(path.sep).join('/');
      if (relativa === 'services/supabase.js') return { supabase: servicios.supabase };
      if (relativa === 'services/usuarios.js') return { usuarios: servicios.usuarios };
      if (relativa === 'services/pedidosService.js') return { __esModule: true, default: { getAll: async () => [] } };
      if (relativa === 'services/campanasAfiliados.js') return { campanasAfiliados: servicios.campanas };
      if (relativa === 'theme/theme.js') return { drawerWidth: 260, kdsColors: {} };
      if ((relativa.startsWith('pages/') && relativa !== 'pages/dueno/Afiliados.jsx') || relativa === 'components/AccesoNoAutorizado.jsx') {
        return { __esModule: true, default: () => React.createElement('pagina', { nombre: relativa }) };
      }
      return cargar(destino);
    };
    Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
    cache.set(archivo, modulo.exports);
    return modulo.exports;
  }
  return cargar(path.join(src, 'app.jsx')).default;
}

const servicioVacio = () => ({
  listar: async () => [],
  listarSolicitudes: async () => [],
  resolverSolicitud: async () => ({}),
});

async function montar(t, { usuario = dueno(7), ruta = '/dueno/afiliados', perfil, campanas } = {}) {
  const anterior = global.localStorage;
  const datos = new Map(usuario ? [
    ['coffeefaster_authenticated', 'true'], ['coffeefaster_user', JSON.stringify(usuario)],
  ] : []);
  global.localStorage = {
    getItem: clave => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, valor),
    removeItem: clave => datos.delete(clave),
  };
  const App = cargarApp({
    supabase: { auth: { getSession: async () => ({ data: { session: usuario ? {} : null } }), signOut: async () => {} } },
    usuarios: { getPerfilSesion: async () => perfil ?? ({ success: true, user: usuario, rol: usuario?.roles?.nombre }) },
    campanas: campanas ?? servicioVacio(),
  });
  function Ubicacion() { return React.createElement('ruta', { path: useLocation().pathname }); }
  let tree;
  t.after(() => { if (tree) act(() => tree.unmount()); global.localStorage = anterior; });
  await act(async () => {
    tree = create(React.createElement(MemoryRouter, { initialEntries: [ruta] },
      React.createElement(App), React.createElement(Ubicacion)));
  });
  return {
    tree,
    texto: () => JSON.stringify(tree.toJSON()),
    ruta: () => tree.root.findByType('ruta').props.path,
    boton: etiqueta => tree.root.findAllByType('ListItemButton').find(b =>
      b.findAllByType('ListItemText').some(texto => texto.props.primary === etiqueta)),
    accion: etiqueta => tree.root.findAllByType('Button').find(b => b.children.includes(etiqueta)),
    articulos: () => tree.root.findAll(n => n.type === 'Box' && typeof n.props?.['aria-label'] === 'string' &&
      n.props['aria-label'].startsWith('Solicitud ')),
    seleccionar: async (etiqueta, valor) => {
      const control = tree.root.findAllByType('select').find(s => s.props['aria-label'] === etiqueta);
      assert.ok(control, `No existe el selector ${etiqueta}`);
      await act(async () => control.props.onChange({ target: { value: String(valor) } }));
    },
  };
}

test('el dueño abre Afiliados desde el menú, con cabecera y selección activas', async t => {
  const h = await montar(t, { ruta: '/dueno/dashboard' });
  assert.equal(h.boton('Afiliados').props.selected, false);
  await act(async () => h.boton('Afiliados').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados');
  assert.equal(h.boton('Afiliados').props.selected, true);
  assert.equal(h.tree.root.findByType('Chip').props.label, 'Cafetería #7');
  assert.ok(h.tree.root.findAllByType('Typography').some(n => n.props.variant === 'h4' && n.children.includes('Afiliados')));
});

for (const cafeteria of [7, 12, '25']) {
  test(`abrir directamente conserva la cafetería ${cafeteria} del perfil e ignora la URL`, async t => {
    const h = await montar(t, { usuario: dueno(cafeteria), ruta: '/dueno/afiliados?cafeteria_id=999' });
    assert.equal(h.ruta(), '/dueno/afiliados');
    assert.equal(h.tree.root.findByType('Chip').props.label, `Cafetería #${cafeteria}`);
    assert.doesNotMatch(h.texto(), /Cafetería #999/);
  });
}

for (const cafeteria of [null, '', 0, -1, 'invalida', true, 1.5]) {
  test(`una asignación inválida (${JSON.stringify(cafeteria)}) muestra aviso sin inventar cafetería`, async t => {
    const h = await montar(t, { usuario: dueno(cafeteria) });
    assert.equal(h.tree.root.findByType('Alert').props.severity, 'warning');
    assert.match(h.texto(), /No hay una cafetería asignada/);
    assert.equal(h.tree.root.findAllByType('Chip').length, 0);
  });
}

test('empleado no ve el menú ni accede por URL a Afiliados', async t => {
  const h = await montar(t, { usuario: { ...dueno(12), roles: { nombre: 'empleado' } } });
  assert.equal(h.ruta(), '/empleado/comandas');
  assert.equal(h.boton('Afiliados'), undefined);
  assert.equal(h.tree.root.findAllByType('Paper').length, 0);
});

test('sin sesión la URL protegida vuelve al login', async t => {
  const h = await montar(t, { usuario: null });
  assert.equal(h.ruta(), '/');
  assert.equal(h.tree.root.findByType('pagina').props.nombre, 'pages/auth/Login.jsx');
});

test('un rol desconocido no obtiene acceso de dueño', async t => {
  const h = await montar(t, { usuario: { ...dueno(7), roles: { nombre: 'admin' } } });
  assert.notEqual(h.ruta(), '/dueno/afiliados');
  assert.equal(h.tree.root.findAllByType('Paper').length, 0);
});

for (const cafeteria of [12, null]) {
  test(`recuperar el perfil cambia el contexto a ${cafeteria} y elimina el anterior`, async t => {
    let resolver;
    const perfil = new Promise(resolve => { resolver = resolve; });
    const h = await montar(t, { perfil });
    assert.equal(h.tree.root.findByType('Chip').props.label, 'Cafetería #7');
    await act(async () => resolver({ success: true, user: dueno(cafeteria), rol: 'dueño' }));
    assert.doesNotMatch(h.texto(), /Cafetería #7/);
    if (cafeteria === null) assert.match(h.texto(), /No hay una cafetería asignada/);
    else assert.equal(h.tree.root.findByType('Chip').props.label, 'Cafetería #12');
  });
}

test('cerrar sesión retira el menú y el contexto de Afiliados', async t => {
  const h = await montar(t);
  await act(async () => h.boton('Cerrar Sesión').props.onClick());
  assert.equal(h.ruta(), '/');
  assert.equal(h.boton('Afiliados'), undefined);
  assert.doesNotMatch(h.texto(), /Cafetería #7/);
});


// Carga el servicio real con el cliente del gateway sustituido por respuestas en memoria.
function cargarServicioSolicitudes(respuestas) {
  const archivo = path.join(src, 'services/campanasAfiliados.js');
  const modulo = { exports: {} };
  const llamadas = [];
  const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
    format: 'cjs', loader: 'js', target: 'node22', sourcefile: archivo,
  }).code;
  const importar = nombre => {
    assert.equal(nombre, './backendApi');
    return {
      BASE_BACKEND: 'http://gateway',
      request: async (url, opciones = {}) => {
        llamadas.push({ url, opciones });
        const respuesta = respuestas[llamadas.length - 1];
        if (respuesta instanceof Error) throw respuesta;
        return respuesta;
      },
    };
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  return { modulo: modulo.exports, llamadas };
}

// Solicitud de prueba con los campos que devuelve el contrato C05.
const solicitud = (id, estado, extra = {}) => ({
  id, solicitante: `Estudiante ${id}`, estado, plan_promocion: `Plan ${id}`, enlace_publico: null,
  ...(estado === 'aprobada' ? { codigo: `CF-${id}`, codigo_activo: true } : {}), ...extra,
});

const campanasDePrueba = [
  { id: 31, nombre: 'Semana del café', comision_pct: 12.5 },
  { id: 32, nombre: 'Fin de mes', comision_pct: 5 },
];

test('carga campañas y solicitudes de la cafetería del perfil con la comisión vigente', async t => {
  const vistas = [];
  const h = await montar(t, {
    campanas: {
      listar: async cafeteria => { vistas.push(['campanas', cafeteria]); return campanasDePrueba; },
      listarSolicitudes: async (cafeteria, campana) => {
        vistas.push(['solicitudes', cafeteria, campana]);
        return [solicitud(82, 'pendiente'), solicitud(83, 'aprobada')];
      },
      resolverSolicitud: async () => ({}),
    },
  });
  assert.deepEqual(vistas, [['campanas', 7], ['solicitudes', 7, 31]]);
  assert.match(h.texto(), /Semana del café/);
  assert.match(h.texto(), /12\.5%/);
  assert.match(h.texto(), /Estudiante 82/);
  assert.match(h.texto(), /CF-83/);
  assert.match(h.texto(), /activo/);
  assert.equal(h.articulos().length, 2);
  assert.ok(h.accion('Aprobar'));
  assert.ok(h.accion('Desactivar'));
  assert.ok(h.accion('Rechazar'));
});

test('el filtro por estado se aplica sin repetir la consulta al servidor', async t => {
  let consultas = 0;
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async () => {
        consultas += 1;
        return [solicitud(82, 'pendiente'), solicitud(83, 'aprobada')];
      },
    },
  });
  await h.seleccionar('Estado', 'pendiente');
  assert.equal(consultas, 1);
  assert.equal(h.articulos().length, 1);
  assert.match(h.texto(), /Estudiante 82/);
  assert.doesNotMatch(h.texto(), /Estudiante 83/);
});

test('un código en uso se corrige y recarga la solicitud', async t => {
  const decisiones = [];
  let consultas = 0;
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async () => { consultas += 1; return [solicitud(82, 'pendiente')]; },
      resolverSolicitud: async (cafeteria, campana, solicitudId, decision, codigo) => {
        decisiones.push([cafeteria, campana, solicitudId, decision, codigo]);
        if (codigo === 'USADO') throw new Error('Ese código ya está en uso. Elige otro.');
        return { id: solicitudId, estado: 'aprobada', codigo, codigo_activo: true };
      },
    },
  });
  await act(async () => h.accion('Aprobar').props.onClick());
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'USADO' } }));
  await act(async () => h.accion('Confirmar').props.onClick());
  assert.match(h.texto(), /Ese código ya está en uso/);
  assert.equal(consultas, 1);
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-NUEVO' } }));
  await act(async () => h.accion('Confirmar').props.onClick());
  assert.deepEqual(decisiones, [[7, 31, 82, 'aprobar', 'USADO'], [7, 31, 82, 'aprobar', 'CF-NUEVO']]);
  assert.equal(consultas, 2);
  assert.equal(h.accion('Confirmar'), undefined);
});

test('rechazar y desactivar envían cada decisión sin mezclarlas', async t => {
  const decisiones = [];
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async () => [solicitud(82, 'pendiente'), solicitud(83, 'aprobada')],
      resolverSolicitud: async (cafeteria, campana, solicitudId, decision) => {
        decisiones.push([cafeteria, campana, solicitudId, decision]);
        return {};
      },
    },
  });
  await act(async () => h.accion('Rechazar').props.onClick());
  await act(async () => h.accion('Confirmar').props.onClick());
  await act(async () => h.accion('Desactivar').props.onClick());
  await act(async () => h.accion('Confirmar').props.onClick());
  assert.deepEqual(decisiones, [[7, 31, 82, 'rechazar'], [7, 31, 83, 'desactivar']]);
});

test('cambiar de campaña descarta solicitudes que llegan después', async t => {
  let resolverTardio;
  const tardia = new Promise(resolve => { resolverTardio = resolve; });
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async (_cafeteria, campana) => (campana === 31 ? tardia : [solicitud(99, 'pendiente')]),
    },
  });
  await h.seleccionar('Campaña', 32);
  await act(async () => resolverTardio([solicitud(82, 'pendiente')]));
  assert.match(h.texto(), /Estudiante 99/);
  assert.doesNotMatch(h.texto(), /Estudiante 82/);
});

// Cubre éxito y fallo tardíos de la campaña anterior con otra decisión en curso.
for (const desenlace of ['resolver', 'rechazar']) {
  test(`una respuesta ${desenlace} de la campaña anterior no altera la decisión vigente`, async t => {
    let completarA;
    let rechazarA;
    let completarB;
    const parcheA = new Promise((resolve, reject) => { completarA = resolve; rechazarA = reject; });
    const parcheB = new Promise(resolve => { completarB = resolve; });
    const decisiones = [];
    const h = await montar(t, {
      campanas: {
        ...servicioVacio(),
        listar: async () => campanasDePrueba,
        listarSolicitudes: async (_cafeteria, campana) => [solicitud(campana === 31 ? 82 : 99, 'pendiente')],
        resolverSolicitud: async (_cafeteria, campana, solicitudId, decision, codigo) => {
          decisiones.push([campana, solicitudId, decision, codigo]);
          return campana === 31 ? parcheA : parcheB;
        },
      },
    });
    await act(async () => h.accion('Aprobar').props.onClick());
    await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-A' } }));
    await act(async () => { h.accion('Confirmar').props.onClick(); });
    await h.seleccionar('Campaña', 32);
    await act(async () => h.accion('Aprobar').props.onClick());
    await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-B' } }));
    await act(async () => { h.accion('Confirmar').props.onClick(); });
    assert.equal(h.accion('Confirmar').props.disabled, true);
    await act(async () => {
      if (desenlace === 'resolver') completarA({});
      else rechazarA(new Error('error de la campaña 31'));
    });
    assert.match(h.texto(), /Asignar código a Estudiante 99/);
    assert.equal(h.tree.root.findByType('TextField').props.value, 'CF-B');
    assert.equal(h.accion('Confirmar').props.disabled, true);
    assert.equal(h.tree.root.findAllByType('Alert').filter(a => a.props.severity === 'error').length, 0);
    assert.deepEqual(decisiones, [[31, 82, 'aprobar', 'CF-A'], [32, 99, 'aprobar', 'CF-B']]);
    await act(async () => completarB({}));
    assert.equal(h.accion('Confirmar'), undefined);
  });
}

test('una decisión anterior no cierra la nueva dentro de la misma campaña', async t => {
  let completarVieja;
  let completarNueva;
  const parcheVieja = new Promise(resolve => { completarVieja = resolve; });
  const parcheNueva = new Promise(resolve => { completarNueva = resolve; });
  const decisiones = [];
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async () => [solicitud(82, 'pendiente')],
      resolverSolicitud: async (_cafeteria, campana, solicitudId, decision, codigo) => {
        decisiones.push([campana, solicitudId, decision, codigo]);
        return decisiones.length === 1 ? parcheVieja : parcheNueva;
      },
    },
  });
  await act(async () => h.accion('Aprobar').props.onClick());
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-VIEJO' } }));
  await act(async () => { h.accion('Confirmar').props.onClick(); });
  await act(async () => h.accion('Cancelar').props.onClick());
  await act(async () => h.accion('Aprobar').props.onClick());
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-NUEVO' } }));
  await act(async () => { h.accion('Confirmar').props.onClick(); });
  await act(async () => completarVieja({}));
  assert.ok(h.accion('Confirmar'));
  assert.equal(h.tree.root.findByType('TextField').props.value, 'CF-NUEVO');
  assert.equal(h.accion('Confirmar').props.disabled, true);
  assert.equal(h.tree.root.findAllByType('Alert').filter(a => a.props.severity === 'error').length, 0);
  assert.deepEqual(decisiones, [[31, 82, 'aprobar', 'CF-VIEJO'], [31, 82, 'aprobar', 'CF-NUEVO']]);
  await act(async () => completarNueva({}));
  assert.equal(h.accion('Confirmar'), undefined);
});

test('volver a la campaña inicial no deja que un PATCH pendiente cierre el formulario nuevo', async t => {
  let completarPrimera;
  const parchePrimera = new Promise(resolve => { completarPrimera = resolve; });
  const decisiones = [];
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async (_cafeteria, campana) => [solicitud(campana === 31 ? 82 : 99, 'pendiente')],
      resolverSolicitud: async (cafeteria, campana, solicitudId, decision, codigo) => {
        decisiones.push([cafeteria, campana, solicitudId, decision, codigo]);
        return parchePrimera;
      },
    },
  });
  await act(async () => h.accion('Aprobar').props.onClick());
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-PRIMERO' } }));
  await act(async () => { h.accion('Confirmar').props.onClick(); });
  await h.seleccionar('Campaña', 32);
  await h.seleccionar('Campaña', 31);
  await act(async () => h.accion('Aprobar').props.onClick());
  await act(async () => h.tree.root.findByType('TextField').props.onChange({ target: { value: 'CF-NUEVO' } }));
  await act(async () => completarPrimera({}));
  assert.match(h.texto(), /Asignar código a Estudiante 82/);
  assert.equal(h.tree.root.findByType('TextField').props.value, 'CF-NUEVO');
  assert.equal(h.accion('Confirmar').props.disabled, false);
  assert.equal(h.tree.root.findAllByType('Alert').filter(a => a.props.severity === 'error').length, 0);
  assert.deepEqual(decisiones, [[7, 31, 82, 'aprobar', 'CF-PRIMERO']]);
});

test('el servicio pagina el listado y envía solo la decisión permitida por C05', async () => {
  const base = 'http://gateway/api/afiliados/cafeterias/7/campanas/31/solicitudes';
  const { modulo, llamadas } = cargarServicioSolicitudes([
    { solicitudes: [solicitud(83, 'pendiente')], siguiente_antes_de: 83 },
    { solicitudes: [solicitud(82, 'pendiente')] },
    {},
    {},
    {},
    {},
  ]);
  const filas = await modulo.campanasAfiliados.listarSolicitudes(7, 31);
  assert.deepEqual(filas.map(f => f.id), [83, 82]);
  assert.equal(llamadas[0].url, base);
  assert.equal(llamadas[1].url, `${base}?antes_de=83`);
  await modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'aprobar', ' CF-A ');
  assert.equal(llamadas[2].url, `${base}/82`);
  assert.equal(llamadas[2].opciones.method, 'PATCH');
  assert.deepEqual(JSON.parse(llamadas[2].opciones.body), { decision: 'aprobar', codigo: 'CF-A' });
  await modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'rechazar');
  assert.deepEqual(JSON.parse(llamadas[3].opciones.body), { decision: 'rechazar' });
  await modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'desactivar');
  assert.deepEqual(JSON.parse(llamadas[4].opciones.body), { decision: 'desactivar' });
  await modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'aprobar', '');
  assert.deepEqual(JSON.parse(llamadas[5].opciones.body), { decision: 'aprobar' });
  await assert.rejects(() => modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'invadir'), /Decisión no válida/);
});

test('un conflicto de código del contrato C05 se explica al dueño', async () => {
  const { modulo } = cargarServicioSolicitudes([new Error('codigo_en_uso')]);
  await assert.rejects(
    () => modulo.campanasAfiliados.resolverSolicitud(7, 31, 82, 'aprobar', 'CF-A'),
    /Ese código ya está en uso/,
  );
});

test('un error de acceso del contrato C05 se explica en ambos listados', async () => {
  const campanas = cargarServicioSolicitudes([new Error('sin_acceso_cafeteria')]);
  await assert.rejects(
    () => campanas.modulo.campanasAfiliados.listar(7),
    /No tienes acceso a las solicitudes de esta cafetería/,
  );
  const solicitudes = cargarServicioSolicitudes([new Error('sin_acceso_cafeteria')]);
  await assert.rejects(
    () => solicitudes.modulo.campanasAfiliados.listarSolicitudes(7, 31),
    /No tienes acceso a las solicitudes de esta cafetería/,
  );
});

test('el servicio rechaza respuestas de paginación y solicitudes inválidas', async () => {
  const cursorTexto = cargarServicioSolicitudes([{ solicitudes: [], siguiente_antes_de: '83' }]);
  await assert.rejects(
    () => cursorTexto.modulo.campanasAfiliados.listarSolicitudes(7, 31),
    /Paginación de solicitudes inválida/,
  );
  const cursorIgual = cargarServicioSolicitudes([
    { solicitudes: [solicitud(83, 'pendiente')], siguiente_antes_de: 83 },
    { solicitudes: [], siguiente_antes_de: 83 },
  ]);
  await assert.rejects(
    () => cursorIgual.modulo.campanasAfiliados.listarSolicitudes(7, 31),
    /Paginación de solicitudes inválida/,
  );
  const idInvalido = cargarServicioSolicitudes([{ solicitudes: [{ ...solicitud(83, 'pendiente'), id: 0 }] }]);
  await assert.rejects(
    () => idInvalido.modulo.campanasAfiliados.listarSolicitudes(7, 31),
    /Respuesta de solicitudes inválida/,
  );
});

test('cambiar de cafetería espera las campañas nuevas antes de consultar solicitudes', async t => {
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  let resolverCampanas;
  const campanasTardias = new Promise(resolve => { resolverCampanas = resolve; });
  const consultas = [];
  const h = await montar(t, {
    perfil,
    campanas: {
      listar: async cafeteria => (cafeteria === 7 ? campanasDePrueba : campanasTardias),
      listarSolicitudes: async (cafeteria, campana) => {
        consultas.push([cafeteria, campana]);
        return [solicitud(82, 'pendiente')];
      },
      resolverSolicitud: async () => ({}),
    },
  });
  assert.deepEqual(consultas, [[7, 31]]);
  await act(async () => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  assert.deepEqual(consultas, [[7, 31]]);
  await act(async () => resolverCampanas([{ id: 44, nombre: 'Campaña nueva', comision_pct: 3 }]));
  assert.deepEqual(consultas, [[7, 31], [12, 44]]);
  assert.match(h.texto(), /Estudiante 82/);
});

test('reintentar la carga de campañas vuelve a consultar el servicio', async t => {
  let consultas = 0;
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => {
        consultas += 1;
        if (consultas === 1) throw new Error('fallo temporal');
        return campanasDePrueba;
      },
    },
  });
  assert.equal(consultas, 1);
  assert.match(h.texto(), /fallo temporal/);
  await act(async () => h.accion('Reintentar').props.onClick());
  assert.equal(consultas, 2);
  assert.match(h.texto(), /Semana del café/);
});

test('reintentar la carga de solicitudes vuelve a consultar y muestra el error explicado', async t => {
  let consultas = 0;
  const h = await montar(t, {
    campanas: {
      ...servicioVacio(),
      listar: async () => campanasDePrueba,
      listarSolicitudes: async () => {
        consultas += 1;
        if (consultas === 1) throw new Error('No tienes acceso a las solicitudes de esta cafetería.');
        return [solicitud(82, 'pendiente')];
      },
    },
  });
  assert.equal(consultas, 1);
  assert.match(h.texto(), /No tienes acceso a las solicitudes de esta cafetería/);
  await act(async () => h.accion('Reintentar').props.onClick());
  assert.equal(consultas, 2);
  assert.match(h.texto(), /Estudiante 82/);
});
