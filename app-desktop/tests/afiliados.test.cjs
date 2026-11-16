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
const mui = Object.fromEntries(('Box CssBaseline Drawer List ListItemButton ListItemIcon ListItemText Typography Badge Button Stack IconButton Alert Chip Paper').split(' ')
  .map(nombre => [nombre, ({ children, ...props }) => React.createElement(nombre, props, children)]));

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
      const relativa = path.relative(src, destino);
      if (relativa === 'services/supabase.js') return { supabase: servicios.supabase };
      if (relativa === 'services/usuarios.js') return { usuarios: servicios.usuarios };
      if (relativa === 'services/pedidosService.js') return { __esModule: true, default: { getAll: async () => [] } };
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

async function montar(t, { usuario = dueno(7), ruta = '/dueno/afiliados', perfil } = {}) {
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
