const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

function cargar(file, imports) {
  const rutaBase = path.resolve(__dirname, '../src', file);
  const filename = fs.existsSync(rutaBase) ? rutaBase : [rutaBase + '.js', rutaBase + '.jsx'].find(candidate => fs.existsSync(candidate));
  if (!filename) throw new Error('Módulo sin archivo: ' + file);
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    format: 'cjs', loader: 'jsx', jsx: 'automatic', target: 'node22', sourcefile: filename,
  }).code;
  const importar = name => {
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      const moduleFile = [resolved + '.js', resolved + '.jsx'].find(candidate => fs.existsSync(candidate));
      if (!moduleFile) throw new Error('Import sin archivo: ' + name);
      return cargar(path.relative(path.join(__dirname, '../src'), moduleFile), imports);
    }
    if (name.startsWith('@mui/icons-material/')) return () => React.createElement('i');
    throw new Error('Import sin definir: ' + name);
  };
  Function('require', 'module', 'exports', code)(importar, module, module.exports);
  return module.exports;
}

const campana = (extra = {}) => ({
  id: 1, cafeteria_id: 1, nombre: 'Campaña A', version_condiciones: '1.0',
  tasa_descuento: 10.25, tasa_descuento_oferta: 4.5, tasa_comision: 2.75,
  confirmada_por_dueno: false,
  vigencia_desde: '2026-01-01', vigencia_hasta: '2027-01-01', ...extra,
});
const aceptada = row => ({ ...row, confirmada_por_dueno: true, version_confirmada: row.version_condiciones });
function diferida() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const mui = Object.fromEntries(('Box Typography Paper Button Alert Skeleton Stack Chip Divider FormControlLabel Checkbox CircularProgress Badge Dialog DialogActions DialogContent DialogTitle IconButton InputAdornment MenuItem Switch Tab Tabs TextField Tooltip Table TableBody TableCell TableContainer TableHead TableRow').split(' ').map(name => [
  name, ({ children, control, label, startIcon, icon, action, ...props }) => React.createElement(name, props, children, control, label, action),
]));

async function montar(t, promociones = false) {
  const channels = [];
  const service = {
    obtenerCampanaVigente: async id => campana({ cafeteria_id: Number(id) }),
    async obtenerPanelConvenios(id) {
      const vigente = await service.obtenerCampanaVigente(id);
      return { campanaVigente: vigente, campanas: vigente ? [vigente] : [], movimientos: [], errorMovimientos: '' };
    },
  };
  const supabase = {
    channel() {
      const channel = { on(_event, _filter, callback) { this.callback = callback; return this; }, subscribe() { return this; } };
      channels.push(channel); return channel;
    },
    removeChannel(channel) { channel.removed = true; },
  };
  const imports = {
    '@mui/material': mui,
    '../../services/campanasService': { campanasService: service },
    '../../services/supabase': { supabase },
    '../../services/administracionCafeteria': { promocionesCafeteria: { listar: async () => [] } },
    '../../services/productos': { productos: { getAll: async () => [] } },
  };
  const Condiciones = cargar('pages/dueno/CondicionesCampana.jsx', imports).default;
  imports['./CondicionesCampana'] = Condiciones;
  const Component = promociones ? cargar('pages/dueno/Promociones.jsx', imports).default : Condiciones;
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
  const h = await montar(t);
  assert.match(h.texto(), /10,25/); assert.match(h.texto(), /2,75/);
  assert.equal(h.boton().props.disabled, true);
  const pending = diferida(); let llamadas = 0;
  h.service.confirmarCondiciones = async params => { llamadas++; assert.equal(params.version, '1.0'); return pending.promise; };
  h.marcar();
  act(() => { void h.boton().props.onClick(); void h.boton().props.onClick(); });
  assert.equal(llamadas, 1);
  await act(async () => { pending.resolve(aceptada(campana())); });
  assert.match(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 1);
});

test('muestra descuento normal, oferta y comisión; NULL no se convierte en cero', async t => {
  const h = await montar(t);
  assert.match(h.texto(), /Descuento Normal/);
  assert.match(h.texto(), /Descuento para Ofertas/);
  assert.match(h.texto(), /Tasa de Comisión/);
  assert.match(h.texto(), /10,25/);
  assert.match(h.texto(), /4,50/);
  assert.match(h.texto(), /2,75/);

  h.service.obtenerCampanaVigente = async () => campana({ tasa_descuento_oferta: null });
  await h.emitir();
  assert.match(h.texto(), /No especificado/);
  assert.match(h.texto(), /10,25/);
  assert.doesNotMatch(h.texto(), /0,00%/);
  assert.doesNotMatch(h.texto(), /4,50/);
});

test('cambiar versión desmarca el consentimiento y descarta la confirmación anterior', async t => {
  const h = await montar(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  h.service.obtenerCampanaVigente = async () => campana({ version_condiciones: '2.0', confirmada_por_dueno: true, version_confirmada: '1.0' });
  await h.emitir();
  assert.match(h.texto(), /Pendiente de Aceptación/);
  assert.equal(h.checkbox().props.checked, false);
  await act(async () => { pending.resolve(aceptada(campana())); });
  assert.equal(h.boton().props.disabled, true);
  assert.match(h.texto(), /Pendiente de Aceptación/);
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 0);
});

test('una confirmación de la cafetería anterior no publica éxito en la nueva', async t => {
  const h = await montar(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  await h.cambiar(2);
  assert.equal(h.checkbox().props.checked, false);
  await act(async () => { pending.resolve(aceptada(campana())); });
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/); assert.equal(h.avisos(), 0);
});

test('un cambio de versión recibido en el mismo lote impide publicar la aceptación antigua', async t => {
  const h = await montar(t); const pending = diferida();
  h.service.confirmarCondiciones = () => pending.promise;
  h.marcar(); act(() => { void h.boton().props.onClick(); });
  h.service.obtenerCampanaVigente = async () => campana({ version_condiciones: '2.0' });
  await act(async () => {
    await h.channels[0].callback();
    pending.resolve(aceptada(campana()));
  });
  assert.match(h.texto(), /2.0/);
  assert.doesNotMatch(h.texto(), /aceptadas exitosamente/);
  assert.equal(h.avisos(), 0);
});

test('fallar al confirmar muestra error y permite un reintento explícito', async t => {
  const h = await montar(t);
  h.service.confirmarCondiciones = async () => { throw new Error('Sin conexión'); };
  h.marcar(); await act(async () => { await h.boton().props.onClick(); });
  assert.match(h.texto(), /Sin conexión/); assert.doesNotMatch(h.texto(), /aceptadas exitosamente/);
  assert.equal(h.boton().props.disabled, false); assert.equal(h.avisos(), 0);
});

test('clasifica propuestas, convenios activos y desactivados sin confundir vencimiento', () => {
  const { estadoConvenio } = cargar('utils/condicionesCampana.js', {});
  const ahora = Date.parse('2026-06-01T12:00:00Z');
  const propuesta = campana({ estado: 'pendiente_aceptacion' });
  const activa = aceptada(campana({ estado: 'activa', vigencia_desde: '2026-01-01', vigencia_hasta: '2027-01-01' }));
  const pausada = aceptada(campana({ estado: 'pausada' }));
  const vencida = aceptada(campana({ estado: 'activa', vigencia_desde: '2025-01-01', vigencia_hasta: '2026-01-01' }));

  assert.equal(estadoConvenio(propuesta, ahora).label, 'Propuesto');
  assert.equal(estadoConvenio(activa, ahora).label, 'Activo');
  assert.equal(estadoConvenio(pausada, ahora).label, 'Desactivado');
  assert.equal(estadoConvenio(vencida, ahora).label, 'Vencido');
});

test('el historial muestra la tasa e importe capturados aunque cambie la campaña actual', () => {
  const Historial = cargar('pages/dueno/HistorialConvenio.jsx', { '@mui/material': mui }).default;
  const tree = create(React.createElement(Historial, {
    campanas: [aceptada(campana({ estado: 'activa', tasa_comision: 20 }))],
    movimientos: [{
      id: 7, pedido_id: 81, tipo: 'comision', estado: 'disponible',
      tasa_comision: 5, monto_clp: 500, creado_en: '2026-05-01T12:00:00Z',
      afiliacion: { campana_id: 1 },
    }],
  }));
  const texto = JSON.stringify(tree.toJSON());
  assert.match(texto, /20,00/);
  assert.match(texto, /5,00/);
  assert.match(texto, /\$500/);
});

test('la vista de condiciones muestra propuestas, desactivados y tasas históricas', async t => {
  const h = await montar(t);
  const actual = aceptada(campana({ estado: 'activa', tasa_comision: 20 }));
  h.service.obtenerPanelConvenios = async () => ({
    campanaVigente: actual,
    campanas: [
      { ...actual, id: 1, nombre: 'Convenio actual' },
      campana({ id: 2, nombre: 'Convenio propuesto', estado: 'pendiente_aceptacion' }),
      aceptada(campana({ id: 3, nombre: 'Convenio pausado', estado: 'pausada' })),
    ],
    movimientos: [{
      id: 5, pedido_id: 20, tipo: 'comision', estado: 'disponible', tasa_comision: 5,
      monto_clp: 500, creado_en: '2026-05-01T12:00:00Z', afiliacion: { campana_id: 1 },
    }],
    errorMovimientos: '',
  });
  await h.emitir();
  assert.match(h.texto(), /Convenio propuesto/);
  assert.match(h.texto(), /Convenio pausado/);
  assert.match(h.texto(), /Desactivado/);
  assert.match(h.texto(), /5,00/);
  assert.match(h.texto(), /\$500/);
});

test('el badge se actualiza al confirmar y con cambios Realtime; los errores son visibles', async t => {
  const h = await montar(t, true);
  const badge = () => h.tree.root.findByType('Badge');
  assert.equal(badge().props.invisible, false);
  await act(async () => { h.tree.root.findByType('Tabs').props.onChange(null, 1); });
  h.service.confirmarCondiciones = async () => {
    const row = aceptada(campana()); h.service.obtenerCampanaVigente = async () => row; return row;
  };
  h.marcar(); await act(async () => { await h.boton().props.onClick(); });
  assert.equal(badge().props.invisible, true);
  h.service.obtenerCampanaVigente = async () => campana({ id: 2 });
  await h.emitir(); assert.equal(badge().props.invisible, false);
  h.service.obtenerCampanaVigente = async () => { throw new Error('Consulta fallida'); };
  await h.emitir(); assert.match(h.texto(), /No se pudo comprobar/);
});

test('servicio rechaza perfiles inválidos antes de invocar RPC', async () => {
  for (const perfil of [null, { success: false }, { success: true, rol: 'empleado' },
    { success: true, rol: 'dueño', user: {} }, { success: true, rol: 'dueño', user: { cafeteria_id: 2 } },
    { success: true, rol: 'dueño', user: { cafeteria_id: 1, activo: false } }]) {
    let llamadas = 0;
    const { campanasService } = cargar('services/campanasService.js', {
      './supabase': { supabase: { rpc() { llamadas++; } } },
      './usuarios': { usuarios: { getPerfilSesion: async () => perfil } },
    });
    await assert.rejects(campanasService.confirmarCondiciones({ campanaId: 1, cafeteriaId: 1, version: '1.0' }));
    assert.equal(llamadas, 0);
  }
});

test('el servicio de escritorio conserva las columnas de public.campanas', async () => {
  let seleccion = '';
  const { campanasService } = cargar('services/campanasService.js', {
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

test('servicio no envía identidad del cliente ni acepta una versión, campaña o cafetería distintas', async () => {
  let respuesta = aceptada(campana());
  const { campanasService } = cargar('services/campanasService.js', {
    './supabase': { supabase: { rpc: async (_name, params) => {
      assert.deepEqual(params, { p_campana_id: 1, p_cafeteria_id: 1, p_version: '1.0' });
      return { data: respuesta, error: null };
    } } },
    './usuarios': { usuarios: { getPerfilSesion: async () => ({ success: true, rol: 'dueño', user: { cafeteria_id: 1 } }) } },
  });
  const confirmar = () => campanasService.confirmarCondiciones({ campanaId: 1, cafeteriaId: 1, version: '1.0', usuarioId: 999 });
  assert.equal((await confirmar()).version_confirmada, '1.0');
  for (const row of [null, campana(), aceptada(campana({ id: 2 })), aceptada(campana({ cafeteria_id: 2 })),
    aceptada(campana({ version_condiciones: '2.0' })), { ...aceptada(campana()), version_confirmada: '0.9' }]) {
    respuesta = row; await assert.rejects(confirmar(), /no confirmó/);
  }
});
