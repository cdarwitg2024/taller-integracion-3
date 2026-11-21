// Prueba la vista principal de campañas del dueño y su contexto de cafetería autorizada (E03 / CAM-290, E04 / CAM-225).
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
const mui = Object.fromEntries(('Box CssBaseline Drawer List ListItemButton ListItemIcon ListItemText Typography Badge Button Stack IconButton Alert Chip Paper CircularProgress TextField').split(' ')
  .map(nombre => [nombre, ({ children, action, ...props }) => React.createElement(nombre, props, children, action)]));

// Se ejecutan App, router, layout, sidebar, Afiliados y Campanas reales. Solo se
// sustituyen servicios externos, presentación MUI y páginas de otras tareas.
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
      if (relativa === 'services/campanasAfiliados.js') return servicios.campanas;
      if (relativa === 'theme/theme.js') return { drawerWidth: 260, kdsColors: {} };
      const reales = ['pages/dueno/Afiliados.jsx', 'pages/dueno/Campanas.jsx'];
      if ((relativa.startsWith('pages/') && !reales.includes(relativa)) || relativa === 'components/AccesoNoAutorizado.jsx') {
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

const servicio = (listar, extra = {}) => ({
  campanasAfiliados: { listar, crear: async () => ({}), actualizar: async () => ({}), cambiarEstado: async () => ({}), ...extra },
  validarFormularioCampana: cargarServicioCampanas().modulo.validarFormularioCampana,
});

// Completa los campos obligatorios para que el envío pase la validación de E05.
async function llenarFormularioValido(h) {
  const valores = {
    'Nombre de la campaña': 'Campaña válida',
    'Descuento a precio normal': '15',
    'Descuento en oferta': '5',
    'Comisión': '10',
    'Inicio': '2026-12-01T08:00',
    'Término': '2026-12-15T20:00',
  };
  for (const [etiqueta, valor] of Object.entries(valores)) {
    await act(async () => {
      h.tree.root.findAllByType('TextField').find(c => c.props.label === etiqueta)
        .props.onChange({ target: { value: valor } });
    });
  }
}

// Carga el servicio real sustituyendo solo el cliente autenticado del gateway.
function cargarServicioCampanas() {
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
      request: async (url, opciones = {}) => { llamadas.push({ url, opciones }); return { campanas: [{ id: 31 }] }; },
    };
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  return { modulo: modulo.exports, llamadas };
}

async function montar(t, { usuario = dueno(7), ruta = '/dueno/afiliados/campanas', perfil, campanas } = {}) {
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
    campanas: campanas ?? servicio(async () => []),
  });
  function Ubicacion() { return React.createElement('ruta', { path: useLocation().pathname }); }
  let tree;
  t.after(() => { if (tree) act(() => tree.unmount()); global.localStorage = anterior; });
  await act(async () => {
    tree = create(React.createElement(MemoryRouter, { initialEntries: [ruta] },
      React.createElement(App), React.createElement(Ubicacion)));
  });
  const boton = etiqueta => tree.root.findAllByType('Button').find(b =>
    b.children.some(c => typeof c === 'string' && c.includes(etiqueta)));
  return {
    tree,
    texto: () => textoRenderizado(tree.toJSON()),
    ruta: () => tree.root.findByType('ruta').props.path,
    boton,
    chips: () => tree.root.findAllByType('Chip').map(c => c.props.label),
  };
}

// Extrae solo el texto renderizado; los props pueden contener elementos con
// referencias circulares (startIcon, action) y no son serializables.
function textoRenderizado(nodo) {
  if (nodo === null || nodo === undefined) return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoRenderizado).join(' ');
  if (typeof nodo === 'object' && nodo.children) return textoRenderizado(nodo.children);
  return '';
}

const campana = (id, nombre, estado = 'activa') => ({
  id, nombre, estado, estado_db: estado, confirmada_por_dueno: true,
  version_confirmada: '1.0', version_condiciones: '1.0',
  descuento_normal_pct: 15, descuento_oferta_pct: 5, comision_pct: 10,
  inicio: '2026-12-01T11:00:00.000Z', fin: '2026-12-15T23:00:00.000Z',
});

test('el dueño entra a campañas desde Afiliados', async t => {
  const h = await montar(t, { ruta: '/dueno/afiliados' });
  await act(async () => h.boton('Administrar campañas').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados/campanas');
});

test('el listado carga las campañas de la cafetería activa y conserva el contexto', async t => {
  const llamadas = [];
  const h = await montar(t, { campanas: servicio(async id => { llamadas.push(id); return [campana(31, 'Semana del café')]; }) });
  assert.deepEqual(llamadas, [7]);
  assert.equal(h.ruta(), '/dueno/afiliados/campanas');
  assert.match(h.texto(), /Semana del café/);
  assert.ok(h.chips().includes('Cafetería #7'));
});

test('el contexto usa la cafetería del perfil e ignora el query param', async t => {
  const llamadas = [];
  const h = await montar(t, {
    usuario: dueno(12), ruta: '/dueno/afiliados/campanas?cafeteria_id=999',
    campanas: servicio(async id => { llamadas.push(id); return []; }),
  });
  assert.deepEqual(llamadas, [12]);
  assert.ok(h.chips().includes('Cafetería #12'));
  assert.doesNotMatch(h.texto(), /Cafetería #999/);
});

test('sin campañas aparece el estado vacío', async t => {
  const h = await montar(t);
  assert.match(h.texto(), /Aún no hay campañas/);
});

test('un error de carga muestra alerta y permite reintentar', async t => {
  let intentos = 0;
  const h = await montar(t, { campanas: servicio(async () => {
    intentos += 1;
    if (intentos === 1) throw new Error('sin_acceso_cafeteria');
    return [campana(5, 'Campaña reintentada')];
  }) });
  assert.match(h.texto(), /sin_acceso_cafeteria/);
  await act(async () => h.boton('Reintentar').props.onClick());
  assert.match(h.texto(), /Campaña reintentada/);
  assert.equal(intentos, 2);
});

test('abrir el formulario y volver conserva el contexto del listado sin recargar', async t => {
  let llamadas = 0;
  const h = await montar(t, { campanas: servicio(async () => { llamadas += 1; return [campana(31, 'Semana del café')]; }) });
  assert.equal(llamadas, 1);
  await act(async () => h.boton('Nueva campaña').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados/campanas/nueva');
  assert.match(h.texto(), /Nueva campaña/);
  await act(async () => h.boton('Volver al listado').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados/campanas');
  assert.match(h.texto(), /Semana del café/);
  assert.equal(llamadas, 1);
  assert.ok(h.chips().includes('Cafetería #7'));
});

test('el resumen muestra la campaña y vuelve al listado', async t => {
  const h = await montar(t, { campanas: servicio(async () => [campana(31, 'Semana del café')]) });
  await act(async () => h.boton('Ver resumen').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados/campanas/31');
  assert.match(h.texto(), /Comisión del afiliado/);
  await act(async () => h.boton('Volver al listado').props.onClick());
  assert.equal(h.ruta(), '/dueno/afiliados/campanas');
});

test('sin cafetería autorizada avisa y no consulta campañas', async t => {
  let llamadas = 0;
  const h = await montar(t, { usuario: dueno(null), campanas: servicio(async () => { llamadas += 1; return []; }) });
  assert.equal(llamadas, 0);
  assert.equal(h.tree.root.findByType('Alert').props.severity, 'warning');
  assert.match(h.texto(), /No hay una cafetería asignada/);
});

test('abrir directamente la edición espera el listado y precarga la campaña', async t => {
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31/editar',
    campanas: servicio(async () => [campana(31, 'Semana del café')]),
  });
  assert.equal(h.ruta(), '/dueno/afiliados/campanas/31/editar');
  assert.match(h.texto(), /Editar campaña/);
  const inicio = h.tree.root.findAllByType('TextField').find(c => c.props.label === 'Inicio');
  assert.match(String(inicio.props.value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('abrir directamente el resumen espera el listado y muestra la campaña', async t => {
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31',
    campanas: servicio(async () => [campana(31, 'Semana del café')]),
  });
  assert.match(h.texto(), /Semana del café/);
  assert.doesNotMatch(h.texto(), /No se encontró la campaña/);
});

test('cambiar de cafetería descarta la respuesta atrasada', async t => {
  const pendientes = [];
  const listar = id => new Promise(resolve => pendientes.push({ id, resolve }));
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  const h = await montar(t, { usuario: dueno(7), perfil, campanas: servicio(listar) });
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].id, 7);
  await act(async () => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  assert.equal(pendientes.length, 2);
  assert.equal(pendientes[1].id, 12);
  await act(async () => { pendientes[1].resolve([campana(2, 'Campaña de la 12')]); });
  await act(async () => { pendientes[0].resolve([campana(1, 'Campaña de la 7')]); });
  assert.match(h.texto(), /Campaña de la 12/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
});

// Monta Campanas directamente para observar el render inmediato al cambiar de
// cafetería: fuera de act, tree.update() aplica el render antes de los efectos.
function cargarCampanas(listar, cambiarEstado = async () => ({})) {
  const imports = {
    '@mui/material': mui,
    'react-router-dom': require('react-router-dom'),
    '../../services/campanasAfiliados': {
      campanasAfiliados: { listar, crear: async () => ({}), actualizar: async () => ({}), cambiarEstado },
    },
    '../../components/dueno/PageHeader': cargarCond('components/dueno/PageHeader.jsx', { '@mui/material': mui }),
  };
  return cargarCond('pages/dueno/Campanas.jsx', imports).default;
}

// Entrega la carga diferida dentro de act y espera su microtask: React aplica
// el resultado antes de cerrar el alcance, sin depender del programador de tareas.
async function completarCarga(accion) {
  await act(async () => { accion(); await Promise.resolve(); });
}

async function montarListado(t, listar, ruta = '/', cambiarEstado) {
  const Campanas = cargarCampanas(listar, cambiarEstado);
  const vista = cafeteria => React.createElement(MemoryRouter, { initialEntries: [ruta] },
    React.createElement(Campanas, { currentUser: dueno(cafeteria) }));
  let tree;
  await completarCarga(() => { tree = create(vista(7)); });
  t.after(() => act(() => tree.unmount()));
  return {
    tree,
    actualizar: cafeteria => tree.update(vista(cafeteria)),
    texto: () => textoRenderizado(tree.toJSON()),
    chips: () => tree.root.findAllByType('Chip').map(c => c.props.label),
    boton: etiqueta => tree.root.findAllByType('Button').find(b =>
      b.children.some(c => typeof c === 'string' && c.includes(etiqueta))),
  };
}

test('el primer render al cambiar de cafetería no reutiliza las filas de la anterior', async t => {
  const pendientes = [];
  const h = await montarListado(t, id => new Promise(resolve => pendientes.push({ id, resolve })));
  await completarCarga(() => pendientes[0].resolve([campana(1, 'Campaña de la 7')]));
  assert.match(h.texto(), /Campaña de la 7/);
  assert.ok(h.chips().includes('Cafetería #7'));

  // Render inmediato, todavía sin efectos: ya no puede verse la campaña de la 7
  // ni un estado vacío prematuro mientras carga la 12.
  h.actualizar(12);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
  assert.doesNotMatch(h.texto(), /Aún no hay campañas/);
  assert.ok(h.chips().includes('Cafetería #12'));
  assert.equal(h.tree.root.findAllByType('CircularProgress').length, 1);

  await completarCarga(() => {});
  assert.equal(pendientes[1].id, 12);
  await completarCarga(() => pendientes[1].resolve([campana(2, 'Campaña de la 12')]));
  assert.match(h.texto(), /Campaña de la 12/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
});

test('respuestas invertidas de dos cafeterías no mezclan filas ni errores', async t => {
  const pendientes = [];
  const h = await montarListado(t, id => new Promise((resolve, reject) => pendientes.push({ id, resolve, reject })));
  h.actualizar(12);
  await completarCarga(() => {});
  assert.deepEqual(pendientes.map(p => p.id), [7, 12]);

  // La 12 falla y la 7 responde después: la respuesta vieja no pisa el error
  // vigente ni publica sus filas.
  await completarCarga(() => pendientes[1].reject(new Error('sin_acceso_cafeteria_12')));
  await completarCarga(() => pendientes[0].resolve([campana(1, 'Campaña de la 7')]));
  assert.match(h.texto(), /sin_acceso_cafeteria_12/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
  assert.ok(h.chips().includes('Cafetería #12'));

  // El reintento de la 12 con lista vacía muestra el estado vacío, no datos de la 7.
  act(() => { h.boton('Reintentar').props.onClick(); });
  assert.equal(pendientes[2].id, 12);
  await completarCarga(() => pendientes[2].resolve([]));
  assert.match(h.texto(), /Aún no hay campañas/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
});

test('cambiar de cafetería en el resumen no muestra la campaña de la anterior', async t => {
  const pendientes = [];
  const h = await montarListado(t, id => new Promise(resolve => pendientes.push({ id, resolve })), '/31');
  await completarCarga(() => pendientes[0].resolve([campana(31, 'Semana del café')]));
  assert.match(h.texto(), /Comisión del afiliado/);

  h.actualizar(12);
  assert.doesNotMatch(h.texto(), /Semana del café/);
  assert.doesNotMatch(h.texto(), /Comisión del afiliado/);
  await completarCarga(() => {});
  await completarCarga(() => pendientes[1].resolve([campana(41, 'Campaña de la 12')]));
  assert.match(h.texto(), /No se encontró la campaña/);
  assert.doesNotMatch(h.texto(), /Semana del café/);
});

test('la recarga posterior a guardar en la cafetería nueva no reutiliza datos de la anterior', async t => {
  const llamadas = [];
  const listar = id => {
    llamadas.push(id);
    return Promise.resolve(id === 7 ? [campana(1, 'Campaña de la 7')] : [campana(2, 'Campaña de la 12')]);
  };
  const crear = async id => { llamadas.push(`crear-${id}`); return { id: 32 }; };
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  const h = await montar(t, { usuario: dueno(7), perfil, campanas: servicio(listar, { crear }) });
  assert.match(h.texto(), /Campaña de la 7/);

  await completarCarga(() => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  assert.match(h.texto(), /Campaña de la 12/);
  await act(async () => h.boton('Nueva campaña').props.onClick());
  const formulario = () => h.tree.root.findAllByType('Paper').find(p => typeof p.props.onSubmit === 'function');
  await llenarFormularioValido(h);
  await act(async () => { formulario().props.onSubmit({ preventDefault() {} }); });
  assert.equal(h.ruta(), '/dueno/afiliados/campanas');
  assert.deepEqual(llamadas, [7, 12, 'crear-12', 12]);
  assert.match(h.texto(), /Campaña de la 12/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
});

test('recargar la misma cafetería conserva las tarjetas visibles con carga discreta', async t => {
  const pendientes = [];
  const h = await montarListado(t, id => new Promise(resolve => pendientes.push({ id, resolve })));
  await completarCarga(() => pendientes[0].resolve([campana(1, 'Campaña de la 7')]));
  assert.match(h.texto(), /Campaña de la 7/);
  assert.equal(h.tree.root.findAllByType('CircularProgress').length, 0);

  // Misma cafetería: dispara la recarga con el callback del botón Reintentar.
  await completarCarga(() => {
    const listado = h.tree.root.findAll(n => typeof n.props?.onReintentar === 'function')[0];
    listado.props.onReintentar();
  });
  assert.equal(pendientes[1].id, 7);
  assert.match(h.texto(), /Campaña de la 7/);
  assert.doesNotMatch(h.texto(), /Aún no hay campañas/);
  const indicadores = h.tree.root.findAllByType('CircularProgress');
  assert.equal(indicadores.length, 1);
  assert.equal(indicadores[0].props['aria-label'], 'Actualizando campañas');

  await completarCarga(() => pendientes[1].resolve([campana(2, 'Campaña actualizada')]));
  assert.match(h.texto(), /Campaña actualizada/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
  assert.equal(h.tree.root.findAllByType('CircularProgress').length, 0);
});

test('cambiar de cafetería reinicia el formulario de creación', async t => {
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  const h = await montar(t, {
    usuario: dueno(7), ruta: '/dueno/afiliados/campanas/nueva', perfil,
    campanas: servicio(async () => []),
  });
  const nombre = () => h.tree.root.findAllByType('TextField').find(c => c.props.label === 'Nombre de la campaña');
  await act(async () => nombre().props.onChange({ target: { value: 'Campaña de la 7' } }));
  assert.equal(nombre().props.value, 'Campaña de la 7');
  await act(async () => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  assert.equal(nombre().props.value, '');
});

test('un guardado pendiente de la cafetería anterior no navega ni publica datos en la nueva', async t => {
  const listar = id => Promise.resolve([campana(id, `Campaña de la ${id}`)]);
  let resolverCrear;
  const crear = () => new Promise(resolve => { resolverCrear = resolve; });
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  const h = await montar(t, {
    usuario: dueno(7), ruta: '/dueno/afiliados/campanas/nueva', perfil,
    campanas: servicio(listar, { crear }),
  });
  const formulario = () => h.tree.root.findAllByType('Paper').find(p => typeof p.props.onSubmit === 'function');
  const nombre = () => h.tree.root.findAllByType('TextField').find(c => c.props.label === 'Nombre de la campaña');
  await llenarFormularioValido(h);
  await act(async () => { formulario().props.onSubmit({ preventDefault() {} }); });
  await act(async () => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  await act(async () => nombre().props.onChange({ target: { value: 'Borrador de la 12' } }));
  await act(async () => { resolverCrear({ id: 31 }); });
  assert.equal(h.ruta(), '/dueno/afiliados/campanas/nueva');
  assert.equal(nombre().props.value, 'Borrador de la 12');
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);
});

test('un guardado rechazado de la cafetería anterior no muestra su error en la nueva', async t => {
  const listar = id => Promise.resolve([campana(id, `Campaña de la ${id}`)]);
  let rechazarCrear;
  const crear = () => new Promise((_, reject) => { rechazarCrear = reject; });
  let resolverPerfil;
  const perfil = new Promise(resolve => { resolverPerfil = resolve; });
  const h = await montar(t, {
    usuario: dueno(7), ruta: '/dueno/afiliados/campanas/nueva', perfil,
    campanas: servicio(listar, { crear }),
  });
  const formulario = () => h.tree.root.findAllByType('Paper').find(p => typeof p.props.onSubmit === 'function');
  const nombre = () => h.tree.root.findAllByType('TextField').find(c => c.props.label === 'Nombre de la campaña');
  await llenarFormularioValido(h);
  await act(async () => { formulario().props.onSubmit({ preventDefault() {} }); });
  await act(async () => resolverPerfil({ success: true, user: dueno(12), rol: 'dueño' }));
  await act(async () => nombre().props.onChange({ target: { value: 'Borrador de la 12' } }));
  await act(async () => rechazarCrear(new Error('guardado_atrasado_de_la_7')));
  assert.equal(h.ruta(), '/dueno/afiliados/campanas/nueva');
  assert.equal(nombre().props.value, 'Borrador de la 12');
  assert.doesNotMatch(h.texto(), /guardado_atrasado_de_la_7/);
  assert.equal(h.tree.root.findAllByType('Alert').some(a => a.props.severity === 'error'), false);
});

test('un error de carga en el resumen se distingue de una campaña inexistente y permite reintentar', async t => {
  let intentos = 0;
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31',
    campanas: servicio(async () => {
      intentos += 1;
      if (intentos === 1) throw new Error('sin_acceso_cafeteria');
      return [campana(31, 'Semana del café')];
    }),
  });
  assert.match(h.texto(), /sin_acceso_cafeteria/);
  assert.doesNotMatch(h.texto(), /No se encontró la campaña/);
  await act(async () => h.boton('Reintentar').props.onClick());
  assert.match(h.texto(), /Semana del café/);
  assert.equal(intentos, 2);
});

test('un error de carga en la edición se distingue de una campaña inexistente y permite reintentar', async t => {
  let intentos = 0;
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31/editar',
    campanas: servicio(async () => {
      intentos += 1;
      if (intentos === 1) throw new Error('sin_acceso_cafeteria');
      return [campana(31, 'Semana del café')];
    }),
  });
  assert.match(h.texto(), /sin_acceso_cafeteria/);
  assert.doesNotMatch(h.texto(), /No se encontró la campaña/);
  await act(async () => h.boton('Reintentar').props.onClick());
  assert.match(h.texto(), /Editar campaña/);
  assert.equal(intentos, 2);
});

test('una campaña inexistente tras una carga exitosa avisa sin ofrecer reintento', async t => {
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/99',
    campanas: servicio(async () => [campana(31, 'Semana del café')]),
  });
  assert.match(h.texto(), /No se encontró la campaña/);
  assert.equal(h.boton('Reintentar'), undefined);
});

test('el servicio sigue el contrato C02 con el cliente autenticado', async () => {
  const { modulo, llamadas } = cargarServicioCampanas();
  const { campanasAfiliados, prepararCampana, validarFormularioCampana } = modulo;
  const form = {
    nombre: 'Semana del café', descuento_normal_pct: '15', descuento_oferta_pct: '5',
    comision_pct: '10', inicio: '2026-12-01T08:00', fin: '2026-12-15T20:00',
  };
  assert.deepEqual(await campanasAfiliados.listar(7), [{ id: 31 }]);
  await campanasAfiliados.crear(7, form);
  await campanasAfiliados.actualizar(7, 31, { ...form, descuento_normal_pct: '12' });

  assert.equal(llamadas[0].url, 'http://gateway/api/afiliados/cafeterias/7/campanas/administracion');
  assert.equal(llamadas[0].opciones.method, undefined);
  assert.equal(llamadas[1].url, 'http://gateway/api/afiliados/cafeterias/7/campanas');
  assert.equal(llamadas[1].opciones.method, 'POST');
  const creada = JSON.parse(llamadas[1].opciones.body);
  assert.deepEqual(Object.keys(creada).sort(),
    ['comision_pct', 'descuento_normal_pct', 'descuento_oferta_pct', 'fin', 'inicio', 'nombre']);
  assert.equal(creada.comision_pct, 10);
  assert.equal(llamadas[2].url, 'http://gateway/api/afiliados/cafeterias/7/campanas/31');
  assert.equal(llamadas[2].opciones.method, 'PATCH');
  assert.equal(JSON.parse(llamadas[2].opciones.body).descuento_normal_pct, 12);
  await campanasAfiliados.actualizar(7, 31, { ...form, inicio: '', fin: '' });
  const parcheSinFechas = JSON.parse(llamadas[3].opciones.body);
  assert.equal(Object.hasOwn(parcheSinFechas, 'inicio'), false);
  assert.equal(Object.hasOwn(parcheSinFechas, 'fin'), false);

  assert.throws(() => prepararCampana({ ...form, nombre: 'ab' }), /entre 3 y 120/);
  assert.throws(() => prepararCampana({ ...form, descuento_normal_pct: '' }), /obligatorio/);
  assert.throws(() => prepararCampana({ ...form, comision_pct: '101' }), /entre 0 y 100/);
  for (const campo of ['descuento_normal_pct', 'descuento_oferta_pct', 'comision_pct']) {
    assert.match(validarFormularioCampana({ ...form, [campo]: '12.345' }).errores[campo], /dos decimales/);
    assert.throws(() => prepararCampana({ ...form, [campo]: '12.345' }), /dos decimales/);
  }
  assert.deepEqual(validarFormularioCampana({
    ...form, descuento_normal_pct: '15.25', descuento_oferta_pct: '5.5', comision_pct: '10.01',
  }).errores, {});
  const sinFechas = { ...form, inicio: '', fin: '' };
  assert.match(validarFormularioCampana(sinFechas, true).errores.inicio, /obligatorio en el alta/);
  assert.match(validarFormularioCampana(sinFechas, true).errores.fin, /obligatorio en el alta/);
  assert.throws(() => prepararCampana(sinFechas, true), /obligatorio en el alta/);
  assert.deepEqual(validarFormularioCampana(sinFechas).errores, {}, 'la edición admite fechas vacías');
  const ofertaMayor = { ...form, descuento_normal_pct: '10', descuento_oferta_pct: '15' };
  assert.match(validarFormularioCampana(ofertaMayor).errores.descuento_oferta_pct, /no puede superar/);
  assert.throws(() => prepararCampana(ofertaMayor), /no puede superar/);
  assert.throws(() => prepararCampana({ ...form, fin: form.inicio }), /posterior al inicio/);
  assert.equal(validarFormularioCampana({ ...form, comision_pct: '   ' }).errores.comision_pct, 'La comisión es obligatoria.');
  assert.equal(validarFormularioCampana({ ...form, comision_pct: true }).errores.comision_pct, 'La comisión es obligatoria.');
  assert.equal(validarFormularioCampana({ ...form, inicio: '2026-02-30T10:00' }).errores.inicio, 'Revisa la fecha de vigencia.');
  assert.throws(() => prepararCampana({ ...form, inicio: '2026-02-30T10:00' }), /fecha de vigencia/);
  assert.deepEqual(validarFormularioCampana({
    ...form, inicio: '2026-12-01T08:00:00.000Z', fin: '2026-12-15T20:00:00-03:00',
  }).errores, {});
  assert.match(prepararCampana({ ...form, inicio: '2026-12-01T08:00:00.000Z' }).inicio, /^2026-12-01T08:00:00\.000Z$/);
  assert.throws(() => prepararCampana({ ...form, fin: '2026-12-01T07:59' }), /posterior al inicio/);
});

test('la edición normaliza tasas nulas y conserva los valores existentes', async t => {
  const existente = {
    ...campana(31, 'Campaña heredada'),
    descuento_oferta_pct: null,
    inicio: '2026-12-01T11:00:00.000Z',
    fin: null,
  };
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31/editar',
    campanas: servicio(async () => [existente]),
  });
  const campo = etiqueta => h.tree.root.findAllByType('TextField').find(c => c.props.label === etiqueta);

  assert.equal(campo('Nombre de la campaña').props.value, 'Campaña heredada');
  assert.equal(campo('Descuento a precio normal').props.value, 15);
  assert.equal(campo('Descuento en oferta').props.value, '');
  assert.equal(campo('Comisión').props.value, 10);
  assert.ok(campo('Inicio').props.value);
  assert.equal(campo('Término').props.value, '');
  assert.equal(campo('Descuento en oferta').props.error, false);
  await act(async () => campo('Descuento en oferta').props.onChange({ target: { value: '5' } }));
  assert.equal(campo('Descuento en oferta').props.value, '5');
});

// Pruebas de condiciones y aceptación de campañas del dueño.
function cargarCond(file, imports) {
  const filename = path.resolve(__dirname, '../src', file);
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    format: 'cjs', loader: 'jsx', jsx: 'automatic', target: 'node22', sourcefile: filename,
  }).code;
  const importar = name => {
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith('.')) return cargarCond(path.relative(path.join(__dirname, '../src'), path.resolve(path.dirname(filename), name + '.js')), imports);
    if (name.startsWith('@mui/icons-material/')) return () => React.createElement('i');
    throw new Error('Import sin definir: ' + name);
  };
  Function('require', 'module', 'exports', code)(importar, module, module.exports);
  return module.exports;
}

const campanaCond = (extra = {}) => ({
  id: 1, cafeteria_id: 1, nombre: 'Campaña A', version_condiciones: '1.0',
  tasa_descuento: 10.25, tasa_descuento_oferta: 4.5, tasa_comision: 2.75, confirmada_por_dueno: false,
  vigencia_desde: '2026-01-01', vigencia_hasta: '2027-01-01', ...extra,
});
const aceptadaCond = row => ({ ...row, confirmada_por_dueno: true, version_confirmada: row.version_condiciones });
function diferida() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const muiCond = Object.fromEntries(('Box Typography Paper Button Alert Skeleton Stack Chip Divider FormControlLabel Checkbox CircularProgress Badge Dialog DialogActions DialogContent DialogTitle IconButton InputAdornment MenuItem Switch Tab Tabs TextField Tooltip').split(' ').map(name => [
  name, ({ children, control, label, startIcon, icon, action, ...props }) => React.createElement(name, props, children, control, label, action),
]));

async function montarCond(t, promociones = false) {
  const channels = [];
  const service = { obtenerCampanaVigente: async id => campanaCond({ cafeteria_id: Number(id) }) };
  const supabase = {
    channel() {
      const channel = { on(_event, _filter, callback) { this.callback = callback; return this; }, subscribe() { return this; } };
      channels.push(channel); return channel;
    },
    removeChannel(channel) { channel.removed = true; },
  };
  const imports = {
    '@mui/material': muiCond,
    '../../services/campanasService': { campanasService: service },
    '../../services/supabase': { supabase },
    '../../services/administracionCafeteria': { promocionesCafeteria: { listar: async () => [] } },
    '../../services/productos': { productos: { getAll: async () => [] } },
  };
  const Condiciones = cargarCond('pages/dueno/CondicionesCampana.jsx', imports).default;
  imports['./CondicionesCampana'] = Condiciones;
  const Component = promociones ? cargarCond('pages/dueno/Promociones.jsx', imports).default : Condiciones;
  let avisos = 0, tree;
  const props = cafeteria_id => ({ currentUser: { id: 9, cafeteria_id }, onConfirmada() { avisos++; } });
  await act(async () => { tree = create(React.createElement(Component, props(1))); });
  t.after(() => act(() => tree.unmount()));
  const checkbox = () => tree.root.findByType('Checkbox');
  const boton = () => tree.root.findAllByType('Button').find(b => b.children.includes('Confirmar Condiciones') || b.children.includes('Confirmando...'));
  return {
    service, tree, channels, checkbox, boton, avisos: () => avisos,
    texto: () => JSON.stringify(tree.toJSON()),
    marcar: () => act(() => checkbox().props.onChange({ target: { checked: true } })),
    emitir: () => act(async () => { for (const c of channels) if (!c.removed) await c.callback(); }),
    cambiar: id => act(async () => { tree.update(React.createElement(Component, props(id))); }),
  };
}

test('muestra tasas exactas y un doble clic solo envía una confirmación', async t => {
  const h = await montarCond(t);
  assert.match(h.texto(), /10,25/); assert.match(h.texto(), /2,75/);
  assert.equal(h.boton().props.disabled, true);
  const pending = diferida(); let llamadas = 0;
  h.service.confirmarCondiciones = async params => { llamadas++; assert.equal(params.version, '1.0'); return pending.promise; };
  h.marcar();
  act(() => { void h.boton().props.onClick(); void h.boton().props.onClick(); });
  assert.equal(llamadas, 1);
  await act(async () => { pending.resolve(aceptadaCond(campanaCond())); });
  assert.match(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 1);
});

test('cambiar versión desmarca el consentimiento y descarta la confirmación anterior', async t => {
  const h = await montarCond(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  h.service.obtenerCampanaVigente = async () => campanaCond({ version_condiciones: '2.0', confirmada_por_dueno: true, version_confirmada: '1.0' });
  await h.emitir();
  assert.match(h.texto(), /Pendiente de Aceptación/);
  assert.equal(h.checkbox().props.checked, false);
  await act(async () => { pending.resolve(aceptadaCond(campanaCond())); });
  assert.equal(h.boton().props.disabled, true);
  assert.match(h.texto(), /Pendiente de Aceptación/);
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 0);
});

test('una confirmación de la cafetería anterior no publica éxito en la nueva', async t => {
  const h = await montarCond(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  await h.cambiar(2);
  assert.equal(h.checkbox().props.checked, false);
  await act(async () => { pending.resolve(aceptadaCond(campanaCond())); });
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 0);
});

test('un cambio de versión recibido en el mismo lote impide publicar la aceptación antigua', async t => {
  const h = await montarCond(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  h.service.obtenerCampanaVigente = async () => campanaCond({ version_condiciones: '2.0' });
  await act(async () => {
    await h.channels[0].callback();
    pending.resolve(aceptadaCond(campanaCond()));
  });
  assert.match(h.texto(), /2.0/);
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/);
  assert.equal(h.avisos(), 0);
});

test('fallar al confirmar muestra error y permite un reintento explícito', async t => {
  const h = await montarCond(t);
  h.service.confirmarCondiciones = async () => { throw new Error('Sin conexión'); };
  h.marcar(); await act(async () => { await h.boton().props.onClick(); });
  assert.match(h.texto(), /Sin conexión/); assert.doesNotMatch(h.texto(), /aceptadas exitosamente/);
  assert.equal(h.boton().props.disabled, false); assert.equal(h.avisos(), 0);
});

test('el badge se actualiza al confirmar y con cambios Realtime; los errores son visibles', async t => {
  const h = await montarCond(t, true);
  const badge = () => h.tree.root.findByType('Badge');
  assert.equal(badge().props.invisible, false);
  await act(async () => { h.tree.root.findByType('Tabs').props.onChange(null, 1); });
  h.service.confirmarCondiciones = async () => {
    const row = aceptadaCond(campanaCond()); h.service.obtenerCampanaVigente = async () => row; return row;
  };
  h.marcar(); await act(async () => { await h.boton().props.onClick(); });
  assert.equal(badge().props.invisible, true);
  h.service.obtenerCampanaVigente = async () => campanaCond({ id: 2 });
  await h.emitir(); assert.equal(badge().props.invisible, false);
  h.service.obtenerCampanaVigente = async () => { throw new Error('Consulta fallida'); };
  await h.emitir(); assert.match(h.texto(), /No se pudo comprobar/);
});

test('servicio rechaza perfiles inválidos antes de invocar RPC', async () => {
  for (const perfil of [null, { success: false }, { success: true, rol: 'empleado' },
    { success: true, rol: 'dueño', user: {} }, { success: true, rol: 'dueño', user: { cafeteria_id: 2 } },
    { success: true, rol: 'dueño', user: { cafeteria_id: 1, activo: false } }]) {
    let llamadas = 0;
    const { campanasService } = cargarCond('services/campanasService.js', {
      './supabase': { supabase: { rpc() { llamadas++; } } },
      './usuarios': { usuarios: { getPerfilSesion: async () => perfil } },
    });
    await assert.rejects(campanasService.confirmarCondiciones({ campanaId: 1, cafeteriaId: 1, version: '1.0' }));
    assert.equal(llamadas, 0);
  }
});

test('servicio no envía identidad del cliente ni acepta una versión, campaña o cafetería distintas', async () => {
  let respuesta = aceptadaCond(campanaCond());
  const { campanasService } = cargarCond('services/campanasService.js', {
    './supabase': { supabase: { rpc: async (_name, params) => {
      assert.deepEqual(params, { p_campana_id: 1, p_cafeteria_id: 1, p_version: '1.0' });
      return { data: respuesta, error: null };
    } } },
    './usuarios': { usuarios: { getPerfilSesion: async () => ({ success: true, rol: 'dueño', user: { cafeteria_id: 1 } }) } },
  });
  const confirmar = () => campanasService.confirmarCondiciones({ campanaId: 1, cafeteriaId: 1, version: '1.0', usuarioId: 999 });
  assert.equal((await confirmar()).version_confirmada, '1.0');
  for (const row of [null, campanaCond(), aceptadaCond(campanaCond({ id: 2 })), aceptadaCond(campanaCond({ cafeteria_id: 2 })),
    aceptadaCond(campanaCond({ version_condiciones: '2.0' })), { ...aceptadaCond(campanaCond()), version_confirmada: '0.9' }]) {
    respuesta = row; await assert.rejects(confirmar(), /no confirmó/);
  }
});



test('el servicio de escritorio conserva las columnas de public.campanas', async () => {
  let seleccion = '';
  const { campanasService } = cargarCond('services/campanasService.js', {
    './supabase': {
      supabase: {
        from(tabla) {
          assert.equal(tabla, 'campanas');
          return {
            select(columnas) {
              seleccion = columnas;
              return { eq: () => ({ order: async () => ({ data: [], error: null }) }) };
            },
          };
        },
      },
    },
    './usuarios': {
      usuarios: {
        getPerfilSesion: async () => ({ success: true, rol: 'dueño', user: { cafeteria_id: 1 } }),
      },
    },
  });

  await campanasService.listar(1);

  for (const campo of [
    'id', 'cafeteria_id', 'nombre', 'descripcion', 'estado', 'version_condiciones',
    'tasa_descuento', 'tasa_descuento_oferta', 'tasa_comision', 'vigencia_desde', 'vigencia_hasta',
    'confirmada_por_dueno', 'fecha_confirmacion', 'usuario_confirma_id',
    'version_confirmada', 'creado_en', 'actualizado_en',
  ]) {
    assert.match(seleccion, new RegExp(`\\b${campo}\\b`), `falta ${campo}`);
  }
});

test('muestra descuento normal, oferta y comisión; NULL no se convierte en cero', async t => {
  const h = await montarCond(t);
  assert.match(h.texto(), /Descuento Normal/);
  assert.match(h.texto(), /Descuento para Ofertas/);
  assert.match(h.texto(), /Tasa de Comisión/);
  assert.match(h.texto(), /10,25/);
  assert.match(h.texto(), /4,50/);
  assert.match(h.texto(), /2,75/);

  h.service.obtenerCampanaVigente = async () => campanaCond({ tasa_descuento_oferta: null });
  await h.emitir();
  assert.match(h.texto(), /No especificado/);
  assert.match(h.texto(), /10,25/);
  assert.doesNotMatch(h.texto(), /0,00%/);
  assert.doesNotMatch(h.texto(), /4,50/);
});

test('el validador del formulario devuelve errores por campo sin descartar valores válidos', () => {
  const { modulo } = cargarServicioCampanas();
  const { errores, nombre } = modulo.validarFormularioCampana({
    nombre: 'Campaña válida', descuento_normal_pct: '', descuento_oferta_pct: '150',
    comision_pct: '10', inicio: '2026-12-15T10:00', fin: '2026-12-01T10:00',
  });
  assert.deepEqual(Object.keys(errores).sort(),
    ['descuento_normal_pct', 'descuento_oferta_pct', 'fin']);
  assert.match(errores.descuento_normal_pct, /obligatorio/);
  assert.match(errores.descuento_oferta_pct, /entre 0 y 100/);
  assert.match(errores.fin, /posterior al inicio/);
  assert.equal(nombre, 'Campaña válida');

  const fechas = modulo.validarFormularioCampana({
    nombre: 'Campaña válida', descuento_normal_pct: '15', descuento_oferta_pct: '5',
    comision_pct: '10', inicio: 'fecha-invalida', fin: '2026-12-15T10:00',
  }).errores;
  assert.deepEqual(Object.keys(fechas), ['inicio']);
});

test('el formulario marca el campo obligatorio omitido y conserva los datos válidos', async t => {
  const creados = [];
  const h = await montar(t, {
    campanas: servicio(async () => [], {
      crear: async (cafeteriaId, form) => { creados.push({ cafeteriaId, form }); return { id: 1 }; },
    }),
  });
  await act(async () => h.boton('Nueva campaña').props.onClick());
  const campos = () => Object.fromEntries(h.tree.root.findAllByType('TextField')
    .map(c => [c.props.label, c]));
  const formulario = () => h.tree.root.findAllByType('Paper').find(p => typeof p.props.onSubmit === 'function');
  // Sin noValidate, el navegador bloquearía el submit antes de mostrar estos errores.
  assert.equal(formulario().props.noValidate, true);
  assert.equal(campos()['Comisión'].props.inputProps.step, 0.01);
  const enviar = () => formulario().props.onSubmit({ preventDefault() {} });
  const cambiar = async (etiqueta, valor) => {
    await act(async () => { campos()[etiqueta].props.onChange({ target: { value: valor } }); });
  };

  await cambiar('Nombre de la campaña', 'Campaña de prueba');
  await cambiar('Descuento a precio normal', '15');
  await cambiar('Comisión', '10');
  await act(async () => enviar());

  assert.equal(campos()['Descuento en oferta'].props.error, true);
  assert.match(campos()['Descuento en oferta'].props.helperText, /obligatorio/);
  assert.equal(campos()['Nombre de la campaña'].props.error, false);
  assert.equal(campos()['Comisión'].props.error, false);
  assert.equal(campos()['Nombre de la campaña'].props.value, 'Campaña de prueba');
  assert.equal(campos()['Descuento a precio normal'].props.value, '15');
  assert.equal(campos()['Comisión'].props.value, '10');
  assert.match(h.texto(), /Revisa los campos marcados/);
  assert.equal(creados.length, 0);

  await cambiar('Descuento en oferta', '5');
  await cambiar('Inicio', '2026-12-01T08:00');
  await cambiar('Término', '2026-12-15T20:00');
  assert.equal(campos()['Descuento en oferta'].props.error, false);
  await cambiar('Comisión', '12.345');
  await act(async () => enviar());
  assert.equal(campos()['Comisión'].props.error, true);
  assert.match(campos()['Comisión'].props.helperText, /dos decimales/);
  assert.equal(creados.length, 0);

  await cambiar('Comisión', '10');
  await cambiar('Descuento en oferta', '20');
  await act(async () => enviar());
  assert.equal(campos()['Descuento en oferta'].props.error, true);
  assert.match(campos()['Descuento en oferta'].props.helperText, /no puede superar/);
  assert.equal(creados.length, 0, 'un descuento en oferta mayor no debe llegar al gateway');

  await cambiar('Descuento en oferta', '5');
  await cambiar('Inicio', '');
  await cambiar('Término', '');
  await act(async () => enviar());
  assert.equal(campos()['Inicio'].props.error, true);
  assert.equal(campos()['Término'].props.error, true);
  assert.equal(creados.length, 0, 'el alta sin vigencia no debe llegar al gateway');

  await cambiar('Inicio', '2026-12-01T08:00');
  await cambiar('Término', '2026-12-15T20:00');
  await act(async () => enviar());

  assert.equal(creados.length, 1);
  assert.equal(creados[0].cafeteriaId, 7);
  assert.equal(creados[0].form.nombre, 'Campaña de prueba');
  assert.equal(creados[0].form.descuento_oferta_pct, '5');
});

test('E14: tasas en los límites y vigencia inválida identifican el campo en el formulario', async t => {
  const { modulo } = cargarServicioCampanas();
  const base = {
    nombre: 'Campaña de límites', descuento_normal_pct: '100', descuento_oferta_pct: '0',
    comision_pct: '100', inicio: '2026-12-01T08:00', fin: '2026-12-15T20:00',
  };
  assert.deepEqual(modulo.validarFormularioCampana(base).errores, {});
  for (const [campo, valor, mensaje] of [
    ['descuento_normal_pct', '-0.01', /El descuento a precio normal debe estar entre 0 y 100/],
    ['descuento_normal_pct', '100.01', /El descuento a precio normal debe estar entre 0 y 100/],
    ['descuento_oferta_pct', '-0.01', /El descuento en oferta debe estar entre 0 y 100/],
    ['descuento_oferta_pct', '100.01', /El descuento en oferta no puede superar/],
    ['comision_pct', '-0.01', /La comisión debe estar entre 0 y 100/],
    ['comision_pct', '100.01', /La comisión debe estar entre 0 y 100/],
  ]) {
    assert.match(modulo.validarFormularioCampana({ ...base, [campo]: valor }).errores[campo], mensaje);
  }
  for (const fecha of ['2026-12-01T25:00', '2026-12-01T08:60', '2026-09-31T08:00']) {
    assert.equal(modulo.validarFormularioCampana({ ...base, inicio: fecha }).errores.inicio,
      'Revisa la fecha de vigencia.');
  }

  const creados = [];
  const h = await montar(t, {
    campanas: servicio(async () => [], {
      crear: async (cafeteriaId, form) => { creados.push({ cafeteriaId, form }); return { id: 1 }; },
    }),
  });
  await act(async () => h.boton('Nueva campaña').props.onClick());
  const campos = () => Object.fromEntries(h.tree.root.findAllByType('TextField')
    .map(c => [c.props.label, c]));
  const formulario = () => h.tree.root.findAllByType('Paper').find(p => typeof p.props.onSubmit === 'function');
  const enviar = () => formulario().props.onSubmit({ preventDefault() {} });
  const cambiar = async (etiqueta, valor) => {
    await act(async () => { campos()[etiqueta].props.onChange({ target: { value: valor } }); });
  };
  await cambiar('Nombre de la campaña', base.nombre);
  await cambiar('Descuento a precio normal', base.descuento_normal_pct);
  await cambiar('Descuento en oferta', base.descuento_oferta_pct);
  await cambiar('Comisión', '101');
  await cambiar('Inicio', '2026-12-01T25:00');
  await cambiar('Término', base.fin);
  await act(async () => enviar());
  assert.match(campos()['Comisión'].props.helperText, /La comisión debe estar entre 0 y 100/);
  assert.match(campos()['Inicio'].props.helperText, /Revisa la fecha de vigencia/);
  assert.equal(campos()['Descuento en oferta'].props.error, false);
  assert.equal(creados.length, 0);

  await cambiar('Comisión', base.comision_pct);
  await cambiar('Inicio', base.inicio);
  await act(async () => enviar());
  assert.equal(creados.length, 1);
  assert.equal(creados[0].form.comision_pct, '100');
  assert.equal(creados[0].form.descuento_normal_pct, '100');
  assert.equal(creados[0].form.inicio, '2026-12-01T08:00');
});

test('cambiarEstado envía solo pausada en el PATCH del contrato C02', async () => {
  const { modulo, llamadas } = cargarServicioCampanas();
  await modulo.campanasAfiliados.cambiarEstado(7, 31, true);
  await modulo.campanasAfiliados.cambiarEstado(7, 31, false);
  assert.equal(llamadas[0].url, 'http://gateway/api/afiliados/cafeterias/7/campanas/31');
  assert.equal(llamadas[0].opciones.method, 'PATCH');
  assert.deepEqual(JSON.parse(llamadas[0].opciones.body), { pausada: true });
  assert.deepEqual(JSON.parse(llamadas[1].opciones.body), { pausada: false });
});

test('pausar y activar desde el listado persiste y recarga el estado visible', async t => {
  const cambios = [];
  let visibles = [campana(31, 'Semana del café')];
  const h = await montar(t, { campanas: servicio(async () => visibles, {
    cambiarEstado: async (cafeteria, id, pausada) => {
      cambios.push({ cafeteria, id, pausada });
      visibles = [campana(id, 'Semana del café', pausada ? 'pausada' : 'activa')];
    },
  }) });
  assert.ok(h.boton('Pausar'));
  await act(async () => h.boton('Pausar').props.onClick());
  assert.deepEqual(cambios, [{ cafeteria: 7, id: 31, pausada: true }]);
  assert.equal(h.boton('Pausar'), undefined);
  assert.ok(h.boton('Activar'));
  assert.ok(h.chips().includes('pausada'));
  await act(async () => h.boton('Activar').props.onClick());
  assert.deepEqual(cambios[1], { cafeteria: 7, id: 31, pausada: false });
  assert.ok(h.chips().includes('activa'));
});

test('el resumen permite pausar la campaña abierta', async t => {
  const cambios = [];
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31',
    campanas: servicio(async () => [campana(31, 'Semana del café')], {
      cambiarEstado: async (cafeteria, id, pausada) => cambios.push({ cafeteria, id, pausada }),
    }),
  });
  assert.ok(h.boton('Pausar'));
  await act(async () => h.boton('Pausar').props.onClick());
  assert.deepEqual(cambios, [{ cafeteria: 7, id: 31, pausada: true }]);
});

test('no se ofrece cambio de estado sin aceptación vigente ni para campañas finalizadas', async t => {
  const h = await montar(t, { campanas: servicio(async () => [
    { ...campana(31, 'Pendiente'), estado: 'programada', estado_db: 'pendiente_aceptacion' },
    { ...campana(32, 'Borrador'), estado: 'programada', estado_db: 'borrador' },
    { ...campana(33, 'Finalizada'), estado: 'finalizada', estado_db: 'activa' },
    { ...campana(34, 'Programada aceptada'), estado: 'programada', estado_db: 'aceptada' },
    { ...campana(35, 'Sin aceptar'), confirmada_por_dueno: false },
    { ...campana(36, 'Versión discordante'), version_confirmada: '0.9' },
  ]) });
  const botones = etiqueta => h.tree.root.findAllByType('Button').filter(b =>
    b.children.some(c => typeof c === 'string' && c.includes(etiqueta)));
  assert.equal(botones('Pausar').length, 1);
  assert.equal(botones('Activar').length, 0);
});

test('un error al cambiar el estado se muestra conservando el listado', async t => {
  const h = await montar(t, { campanas: servicio(async () => [campana(31, 'Semana del café')], {
    cambiarEstado: async () => { throw new Error('campana_no_activa'); },
  }) });
  await act(async () => h.boton('Pausar').props.onClick());
  assert.match(h.texto(), /campana_no_activa/);
  assert.match(h.texto(), /Semana del café/);
  assert.ok(h.boton('Pausar'));
  assert.ok(h.boton('Reintentar'));
  await act(async () => h.boton('Reintentar').props.onClick());
  assert.match(h.texto(), /Semana del café/);
  assert.doesNotMatch(h.texto(), /campana_no_activa/);
});

test('un error al cambiar el estado en el resumen conserva la campaña abierta', async t => {
  const h = await montar(t, {
    ruta: '/dueno/afiliados/campanas/31',
    campanas: servicio(async () => [campana(31, 'Semana del café')], {
      cambiarEstado: async () => { throw new Error('campana_no_activa'); },
    }),
  });
  await act(async () => h.boton('Pausar').props.onClick());
  assert.match(h.texto(), /campana_no_activa/);
  assert.match(h.texto(), /Semana del café/);
  assert.ok(h.boton('Pausar'));
  assert.ok(h.boton('Reintentar'));
});

test('cambiar de cafetería durante el PATCH descarta el resultado y el error atrasados', async t => {
  const pendientes = [];
  const cambios = [];
  const listar = id => Promise.resolve([campana(id, `Campaña de la ${id}`)]);
  const cambiarEstado = (cafeteria, id, pausada) => {
    cambios.push({ cafeteria, id, pausada });
    return new Promise((resolve, reject) => pendientes.push({ resolve, reject }));
  };
  const h = await montarListado(t, listar, '/', cambiarEstado);
  await act(async () => { h.boton('Pausar').props.onClick(); });
  h.actualizar(12);
  await completarCarga(() => pendientes[0].resolve());
  assert.match(h.texto(), /Campaña de la 12/);
  assert.doesNotMatch(h.texto(), /Campaña de la 7/);

  await act(async () => { h.boton('Pausar').props.onClick(); });
  h.actualizar(7);
  await completarCarga(() => pendientes[1].reject(new Error('error de la 12')));
  assert.match(h.texto(), /Campaña de la 7/);
  assert.doesNotMatch(h.texto(), /error de la 12/);
  assert.deepEqual(cambios, [
    { cafeteria: 7, id: 7, pausada: true },
    { cafeteria: 12, id: 12, pausada: true },
  ]);
});
