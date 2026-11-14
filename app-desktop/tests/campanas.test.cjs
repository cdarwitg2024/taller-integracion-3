// Prueba la vista principal de campañas del dueño y su contexto de cafetería autorizada (E03 / CAM-290).
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
      const relativa = path.relative(src, destino);
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

const servicio = (listar, extra = {}) => ({ campanasAfiliados: { listar, crear: async () => ({}), actualizar: async () => ({}), ...extra } });

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
  // Extrae solo el texto renderizado; los props pueden contener elementos con
  // referencias circulares (startIcon, action) y no son serializables.
  const textoDe = (nodo) => {
    if (nodo === null || nodo === undefined) return '';
    if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
    if (Array.isArray(nodo)) return nodo.map(textoDe).join(' ');
    if (typeof nodo === 'object' && nodo.children) return textoDe(nodo.children);
    return '';
  };
  return {
    tree,
    texto: () => textoDe(tree.toJSON()),
    ruta: () => tree.root.findByType('ruta').props.path,
    boton,
    chips: () => tree.root.findAllByType('Chip').map(c => c.props.label),
  };
}

const campana = (id, nombre, estado = 'activa') => ({
  id, nombre, estado, descuento_normal_pct: 15, descuento_oferta_pct: 5, comision_pct: 10,
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

test('el servicio sigue el contrato C02 con el cliente autenticado', async () => {
  const { modulo, llamadas } = cargarServicioCampanas();
  const { campanasAfiliados, prepararCampana } = modulo;
  const form = {
    nombre: 'Semana del café', descuento_normal_pct: '15', descuento_oferta_pct: '5',
    comision_pct: '10', inicio: '2026-12-01T08:00', fin: '2026-12-15T20:00',
  };
  assert.deepEqual(await campanasAfiliados.listar(7), [{ id: 31 }]);
  await campanasAfiliados.crear(7, form);
  await campanasAfiliados.actualizar(7, 31, { ...form, descuento_normal_pct: '12' });

  assert.equal(llamadas[0].url, 'http://gateway/api/afiliados/cafeterias/7/campanas');
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

  assert.throws(() => prepararCampana({ ...form, nombre: 'ab' }), /entre 3 y 120/);
  assert.throws(() => prepararCampana({ ...form, descuento_normal_pct: '' }), /obligatorio/);
  assert.throws(() => prepararCampana({ ...form, comision_pct: '101' }), /entre 0 y 100/);
  assert.throws(() => prepararCampana({ ...form, fin: form.inicio }), /posterior al inicio/);
});
