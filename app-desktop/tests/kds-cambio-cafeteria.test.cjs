// Regresión KDS: aislamiento por cafetería en el componente real y cierre del canal Realtime.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

const src = path.resolve(__dirname, '../src');

function diferida() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function textoRenderizado(nodo) {
  if (nodo === null || nodo === undefined) return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoRenderizado).join(' ');
  if (typeof nodo === 'object' && nodo.children) return textoRenderizado(nodo.children);
  return '';
}

function cargar(archivo, dependencias, loader = 'jsx') {
  const ruta = path.join(src, archivo);
  const codigo = transformSync(fs.readFileSync(ruta, 'utf8'), {
    format: 'cjs', loader, jsx: 'automatic', target: 'node22', sourcefile: ruta,
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

const mui = {
  Box: ({ children, ...props }) => React.createElement('box', props, children),
  Typography: ({ children, ...props }) => React.createElement('typography', props, children),
  Button: ({ children, onClick, ...props }) => React.createElement('button', { ...props, onClick }, children),
  Alert: ({ children, action, severity }) => React.createElement('alert', { severity }, children, action),
  CircularProgress: props => React.createElement('circularprogress', props),
};

const KdsTopBar = props => React.createElement('kdstopbar', { 'data-conexion': props.conexion },
  React.createElement('button', { onClick: props.onEscanear }, 'escanear'));
const KanbanColumn = ({ titulo, count, children }) => React.createElement('columna', { 'data-titulo': titulo, 'data-count': count }, children);
const PedidoCard = ({ pedido, onOpen, onChangeEstado }) => React.createElement('pedidocard', {
  'data-id': String(pedido.id), 'data-estado': pedido.estado,
},
React.createElement('span', null, pedido.codigo_pedido),
React.createElement('button', { onClick: () => onOpen(pedido) }, `abrir-${pedido.id}`),
React.createElement('button', { onClick: e => onChangeEstado(pedido.id, 'en_preparacion', e) }, `preparar-${pedido.id}`));
const DetallePedidoDialog = ({ pedido }) => React.createElement('detalle', { pedido }, pedido ? `detalle-${pedido.id}` : 'detalle-cerrado');
const EscanearQrDialog = ({ open, cafeteriaId }) => React.createElement('escaner', {
  'data-abierto': String(Boolean(open)), 'data-cafeteria': String(cafeteriaId),
});

function crearServicios() {
  const solicitudes = [];
  const detalles = [];
  const actualizaciones = [];
  const anuncios = [];
  const suscripciones = [];
  const pedidosService = {
    getAll({ cafeteriaId }) {
      const solicitud = diferida();
      solicitudes.push({ cafeteriaId, ...solicitud });
      return solicitud.promise;
    },
    getById(id) {
      const consulta = diferida();
      detalles.push({ id, ...consulta });
      return consulta.promise;
    },
    updateEstado(id, estado) {
      const actualizacion = diferida();
      actualizaciones.push({ id, estado, ...actualizacion });
      return actualizacion.promise;
    },
    ordenarPedidos: lista => [...lista].sort((a, b) => Number(a.id) - Number(b.id)),
  };
  const kdsRealtime = {
    suscribir(opciones) {
      const suscripcion = {
        opciones,
        cerrada: false,
        cerrar() { this.cerrada = true; },
      };
      suscripciones.push(suscripcion);
      return suscripcion;
    },
  };
  const vozKds = {
    obtenerEstado: () => 'activa',
    obtenerDiagnostico: () => null,
    suscribir: () => () => {},
    anunciar: comanda => anuncios.push(comanda),
  };
  return { solicitudes, detalles, actualizaciones, anuncios, suscripciones, pedidosService, kdsRealtime, vozKds };
}

function dependencias(servicios) {
  return {
    '@mui/material': mui,
    '../../components/KdsTopBar': KdsTopBar,
    '../../components/KanbanColumn': KanbanColumn,
    '../../components/PedidoCard': PedidoCard,
    '../../components/DetallePedidoDialog': DetallePedidoDialog,
    '../../components/EscanearQrDialog': EscanearQrDialog,
    '../../services/pedidosService': {
      __esModule: true, default: servicios.pedidosService, ordenarPedidos: servicios.pedidosService.ordenarPedidos,
    },
    '../../services/kdsRealtime': {
      __esModule: true, default: servicios.kdsRealtime,
      ESTADO_CONECTADO: 'conectado', ESTADO_RECONECTANDO: 'reconectando',
    },
    '../../services/vozKdsService': {
      __esModule: true, default: servicios.vozKds, VOZ_APAGADA: 'apagada', VOZ_SILENCIADA: 'silenciada',
    },
    '../../theme/theme': { kdsColors: { onDarkSoft: '#555', textSecondary: '#777' } },
    '../../design/tokens': { COLORS: { surfaceAlt: '#111', warningBg: '#222', infoBg: '#333' } },
  };
}

function cargarDetallePedidoDialog(servicios, impresion = {}, generarBoletaBlob = async () => null) {
  const nodo = etiqueta => props => React.createElement(etiqueta, props, props.children);
  const icono = () => React.createElement('icono');
  const componentesMui = (
    'Alert Box Button Chip CircularProgress DialogActions DialogContent DialogTitle Divider '
    + 'IconButton List ListItem ListItemText Snackbar Stack Tooltip Typography'
  ).split(' ');
  const muiDetalle = Object.fromEntries(componentesMui.map(nombre => [nombre, nodo(nombre.toLowerCase())]));
  muiDetalle.ListItemText = ({ primary, secondary }) => React.createElement('listitemtext', null, primary, secondary);
  muiDetalle.Dialog = ({ open, children, ...props }) => React.createElement('dialogo', {
    ...props, 'data-abierto': String(Boolean(open)),
  }, children);

  const dependenciasDetalle = { '@mui/material': muiDetalle };
  'Close Print PlayArrow Check Download Receipt Replay AccessTime'.split(' ').forEach(nombre => {
    dependenciasDetalle[`@mui/icons-material/${nombre}`] = icono;
  });
  Object.assign(dependenciasDetalle, {
    './EstadoChip': nodo('estadochip'),
    '../utils/dateUtils': { origenRetiroPedido: () => ({ tipo: 'sin' }) },
    '../services/boletaPdfService': { generarBoletaBlob },
    '../services/impresionService': {
      __esModule: true,
      default: {
        getEstadoImpresion: () => ({ veces: 0, esReimpresion: false }),
        registrarImpresion: () => ({ veces: 1, esReimpresion: false }),
        imprimirComanda: async () => {},
        imprimirBoleta: async () => {},
        guardarArchivoConUbicacion: async () => ({ ok: true }),
        ...impresion,
      },
    },
    '../services/pedidosService': { __esModule: true, default: servicios.pedidosService },
  });
  return cargar('components/DetallePedidoDialog.jsx', dependenciasDetalle).default;
}

async function completar(accion) {
  await act(async () => {
    if (accion) accion();
    await Promise.resolve();
  });
}

function crearMontaje(t, servicios, overrides = {}) {
  const Comandas = cargar('pages/empleado/Comandas.jsx', { ...dependencias(servicios), ...overrides }).default;
  const vista = usuario => React.createElement(Comandas, { currentUser: usuario });
  let tree;
  t.after(() => { if (tree) act(() => tree.unmount()); });
  return {
    get tree() { return tree; },
    montar: cafeteria => completar(() => { tree = create(vista({ id: 5, cafeteria_id: cafeteria })); }),
    montarUsuario: usuario => completar(() => { tree = create(vista(usuario)); }),
    cambiar: cafeteria => tree.update(vista({ id: 5, cafeteria_id: cafeteria })),
    cambiarUsuario: usuario => tree.update(vista(usuario)),
    completar,
    texto: () => textoRenderizado(tree.toJSON()),
    spinner: () => tree.root.findAllByType('circularprogress').length,
    tarjeta: id => tree.root.findAllByType('pedidocard').find(c => c.props['data-id'] === String(id)),
    boton: etiqueta => tree.root.findAllByType('button').find(b =>
      b.children.some(c => typeof c === 'string' && c.includes(etiqueta))),
  };
}

function pedido(id, cafeteria, estado = 'pendiente') {
  return {
    id,
    rawId: id,
    cafeteria_id: cafeteria,
    codigo_pedido: `#${cafeteria}-${id}`,
    estado,
    creado_en: '2026-11-17T10:00:00.000Z',
    detalles_pedido: [],
    productos: [],
  };
}

// Compara cada aviso tardío con y sin cambio de pedido para probar el guard correspondiente.
async function verificarSinFugaDeAviso(t, { nombre, crear, disparar, mensaje }) {
  const ejecutar = async (cambiarPedido) => {
    const s = crearServicios();
    const accion = crear();
    const h = crearMontaje(t, s, {
      '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, accion.overrides),
    });
    const conProductos = id => ({ ...pedido(id, 7), productos: [{ nombre: 'Café', cantidad: 1 }] });
    await h.montar(7);
    await h.completar(() => s.solicitudes[0].resolve([conProductos(101), conProductos(201)]));
    await h.completar(() => h.boton('abrir-101').props.onClick());
    await h.completar(() => disparar(h));
    if (cambiarPedido) await h.completar(() => h.boton('abrir-201').props.onClick());
    await h.completar(() => accion.resolver());
    return h.texto();
  };

  assert.match(await ejecutar(false), mensaje, `${nombre}: el aviso debe existir sin cambio de pedido`);
  assert.doesNotMatch(await ejecutar(true), mensaje, `${nombre}: el aviso de A no debe filtrarse en B`);
}

test('A→B: el primer render no muestra A, cierra su detalle y descarta snapshot y Realtime atrasados', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => s.suscripciones[0].opciones.onComanda(pedido(102, 7)));
  const cambiarEstadoA = h.boton('preparar-101').props.onClick;
  const abrirDetalle = h.boton('abrir-101');
  await h.completar(() => abrirDetalle.props.onClick());
  await h.completar(() => h.boton('escanear').props.onClick());

  assert.match(h.texto(), /#7-101/);
  assert.match(h.texto(), /#7-102/);
  assert.match(h.texto(), /detalle-101/);
  assert.equal(h.tree.root.findByType('escaner').props['data-abierto'], 'true');
  assert.equal(s.anuncios.length, 1);

  // tree.update sin act: observa el render anterior a los efectos del cambio.
  h.cambiar(12);
  assert.doesNotMatch(h.texto(), /#7-101|#7-102/);
  assert.doesNotMatch(h.texto(), /detalle-101/);
  assert.equal(h.tree.root.findByType('escaner').props['data-abierto'], 'false');
  assert.equal(h.spinner(), 1);

  await h.completar();
  assert.equal(s.suscripciones[0].cerrada, true);
  assert.equal(s.suscripciones[1].opciones.cafeteriaId, 12);
  assert.equal(s.solicitudes[1].cafeteriaId, 12);

  await h.completar(() => s.solicitudes[1].resolve([pedido(201, 12)]));
  assert.match(h.texto(), /#12-201/);
  assert.doesNotMatch(h.texto(), /#7-/);
  assert.equal(s.anuncios.length, 1, 'la carga de B no debe anunciar voz');

  const canalA = s.suscripciones[0].opciones;
  await h.completar(() => canalA.onComanda(pedido(103, 7)));
  await h.completar(() => canalA.onActualizar(pedido(101, 7, 'listo')));
  await h.completar(() => cambiarEstadoA());
  assert.doesNotMatch(h.texto(), /#7-/);
  assert.equal(s.actualizaciones.length, 0, 'una acción de A no debe escribir en B');
  assert.equal(s.anuncios.length, 1, 'un callback atrasado de A no debe anunciar voz');
});

test('A→B: el detalle real de A no se reabre cuando getById responde tarde en B', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());

  const abierto = () => h.tree.root.findAllByType('dialogo').some(d => d.props['data-abierto'] === 'true');
  const consultaA = s.detalles.find(consulta => consulta.id === 101);
  assert.ok(abierto(), 'el detalle de A se abre');
  assert.ok(consultaA, 'un pedido sin productos consulta su detalle completo');

  h.cambiar(12);
  await h.completar();
  assert.equal(abierto(), false, 'el cambio a B cierra el detalle de A');

  await h.completar(() => consultaA.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1, precio: 2500 }],
  }));
  assert.equal(abierto(), false, 'la respuesta tardía de A no reabre el modal en B');
  assert.doesNotMatch(h.texto(), /#7-101|Café/);
});

test('A→B en la MISMA cafetería: el getById tardío de A no sobrescribe el detalle de B', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7), pedido(201, 7)]));

  await h.completar(() => h.boton('abrir-101').props.onClick());
  const consultaA = s.detalles.find(item => item.id === 101);
  assert.ok(consultaA, 'A consulta su detalle completo');

  // Sin cerrar A: la key por cafetería no remonta el modal, cambia solo el pedido.
  await h.completar(() => h.boton('abrir-201').props.onClick());
  const consultaB = s.detalles.find(item => item.id === 201);
  assert.ok(consultaB, 'B consulta su detalle completo');

  const detalle = () => textoRenderizado(h.tree.root.findAllByType('dialogo')
    .find(d => d.props['data-abierto'] === 'true'));
  assert.match(detalle(), /#7-201/);

  await h.completar(() => consultaA.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café A', cantidad: 1, precio: 2500 }],
  }));
  assert.match(detalle(), /#7-201/);
  assert.doesNotMatch(detalle(), /#7-101|Café A/);

  await h.completar(() => consultaB.resolve({
    ...pedido(201, 7), productos: [{ nombre: 'Café B', cantidad: 1, precio: 3000 }],
  }));
  assert.match(detalle(), /Café B/);
  assert.doesNotMatch(detalle(), /#7-101|Café A/);
});

test('A→B: si falla la precarga de impresión de A, B no imprime A ni hereda su chip', async t => {
  const casos = [
    {
      nombre: 'comanda',
      disparar: h => h.boton('Imprimir Comanda').props.onClick(),
      impresion: 'imprimirComanda',
    },
    {
      nombre: 'boleta',
      disparar: h => h.tree.root.findAllByType('tooltip')
        .find(item => String(item.props.title).includes('Imprimir boleta'))
        .findByType('iconbutton').props.onClick(),
      impresion: 'imprimirBoleta',
    },
  ];

  for (const caso of casos) {
    const s = crearServicios();
    const impresos = [];
    const registrados = [];
    const h = crearMontaje(t, s, {
      '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, {
        registrarImpresion: id => {
          registrados.push(id);
          return { veces: 1, esReimpresion: false };
        },
        [caso.impresion]: async pedidoImpreso => { impresos.push(pedidoImpreso.codigo_pedido); },
      }),
    });
    await h.montar(7);
    await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7), pedido(201, 7)]));
    await h.completar(() => h.boton('abrir-101').props.onClick());
    await h.completar(() => caso.disparar(h));
    const consultaImpresionA = s.detalles.filter(item => item.id === 101).at(-1);
    assert.equal(s.detalles.filter(item => item.id === 101).length, 2, `${caso.nombre}: la impresión precarga A`);

    await h.completar(() => h.boton('abrir-201').props.onClick());
    await h.completar(() => consultaImpresionA.reject(new Error('fallo_detalle_A')));

    const detalle = () => textoRenderizado(h.tree.root.findAllByType('dialogo')
      .find(d => d.props['data-abierto'] === 'true'));
    assert.match(detalle(), /#7-201/, caso.nombre);
    assert.deepEqual(impresos, [], `${caso.nombre}: B no debe imprimir A`);
    assert.deepEqual(registrados, [], `${caso.nombre}: B no debe heredar el registro de impresión de A`);
    assert.doesNotMatch(detalle(), /Comanda Impresa|Reimprimir Comanda/, caso.nombre);
  }
});

test('A→B: el detalle real de A no filtra su aviso de impresión en B', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([{
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Imprimir Comanda').props.onClick());
  await h.completar();
  assert.match(h.texto(), /Comanda ##7-101 enviada a impresión/);

  h.cambiar(12);
  await h.completar();
  await h.completar(() => s.solicitudes[1].resolve([pedido(201, 12)]));
  await h.completar(() => h.boton('abrir-201').props.onClick());

  assert.match(h.texto(), /#12-201/);
  assert.doesNotMatch(h.texto(), /Comanda ##7-101 enviada a impresión/);
});

test('Detalle real: cerrar antes de getById evita que la respuesta reabra el modal', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  const consulta = s.detalles.find(item => item.id === 101);
  assert.ok(consulta);

  const dialogo = h.tree.root.findAllByType('dialogo').find(d => d.props['data-abierto'] === 'true');
  await h.completar(() => dialogo.props.onClose());
  await h.completar(() => consulta.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }));

  assert.equal(h.tree.root.findAllByType('dialogo').some(d => d.props['data-abierto'] === 'true'), false);
});

test('Detalle real: cerrar durante la precarga de impresión no reabre el modal', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Imprimir Comanda').props.onClick());

  const consulta = s.detalles.at(-1);
  assert.equal(s.detalles.length, 2, 'la impresión precarga los ítems con getById');
  const dialogo = h.tree.root.findAllByType('dialogo').find(d => d.props['data-abierto'] === 'true');
  await h.completar(() => dialogo.props.onClose());
  await h.completar(() => consulta.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }));

  assert.equal(h.tree.root.findAllByType('dialogo').some(d => d.props['data-abierto'] === 'true'), false);
});

test('Detalle real: cerrar A y abrir B descarta el getById de A y acepta el de B', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7), pedido(201, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  const consultaA = s.detalles.find(item => item.id === 101);
  assert.ok(consultaA);

  const dialogo = h.tree.root.findAllByType('dialogo').find(d => d.props['data-abierto'] === 'true');
  await h.completar(() => dialogo.props.onClose());
  await h.completar(() => h.boton('abrir-201').props.onClick());
  const consultaB = s.detalles.find(item => item.id === 201);
  assert.ok(consultaB);

  await h.completar(() => consultaA.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café A', cantidad: 1 }],
  }));
  assert.doesNotMatch(h.texto(), /Café A/);

  await h.completar(() => consultaB.resolve({
    ...pedido(201, 7), productos: [{ nombre: 'Café B', cantidad: 1 }],
  }));
  assert.match(h.texto(), /Café B/);
  assert.doesNotMatch(h.texto(), /Café A/);
});

test('Detalle real: cerrar durante la precarga de boleta no reabre el modal', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  const tooltip = h.tree.root.findAllByType('tooltip')
    .find(item => String(item.props.title).includes('Imprimir boleta'));
  await h.completar(() => tooltip.findByType('iconbutton').props.onClick());

  const consulta = s.detalles.at(-1);
  assert.equal(s.detalles.length, 2, 'la boleta precarga los ítems con getById');
  const dialogo = h.tree.root.findAllByType('dialogo').find(d => d.props['data-abierto'] === 'true');
  await h.completar(() => dialogo.props.onClose());
  await h.completar(() => consulta.resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }));

  assert.equal(h.tree.root.findAllByType('dialogo').some(d => d.props['data-abierto'] === 'true'), false);
  assert.doesNotMatch(h.texto(), /enviada a impresión térmica/);
});

test('Detalle real: abrir B durante el envío de la impresión de A no muestra el aviso de A', async t => {
  const s = crearServicios();
  const envio = diferida();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, {
      imprimirComanda: () => envio.promise,
    }),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7), pedido(201, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Imprimir Comanda').props.onClick());
  await h.completar(() => s.detalles.at(-1).resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }));
  await h.completar(() => h.boton('abrir-201').props.onClick());
  await h.completar(() => envio.resolve());

  const abierto = h.tree.root.findAllByType('dialogo').find(d => d.props['data-abierto'] === 'true');
  assert.match(textoRenderizado(abierto), /#7-201/);
  assert.doesNotMatch(h.texto(), /Comanda ##7-101 enviada a impresión/);
});

test('Detalle real: un UPDATE del mismo pedido no cancela la impresión en curso', async t => {
  const s = crearServicios();
  const envio = diferida();
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, {
      imprimirComanda: () => envio.promise,
    }),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Imprimir Comanda').props.onClick());
  await h.completar(() => s.detalles.at(-1).resolve({
    ...pedido(101, 7), productos: [{ nombre: 'Café', cantidad: 1 }],
  }));
  await h.completar(() => s.suscripciones[0].opciones.onActualizar(pedido(101, 7, 'en_preparacion')));
  await h.completar(() => envio.resolve());

  assert.match(h.texto(), /Comanda ##7-101 enviada a impresión/);
});

test('Detalle real: ningún aviso tardío de A se filtra al abrir B en la misma cafetería', async t => {
  const imprimirBoleta = h => h.tree.root.findAllByType('tooltip')
    .find(item => String(item.props.title).includes('Imprimir boleta'))
    .findByType('iconbutton').props.onClick();
  const casos = [
    {
      nombre: 'error al enviar comanda',
      crear: () => {
        const respuesta = diferida();
        return {
          overrides: { imprimirComanda: () => respuesta.promise },
          resolver: () => respuesta.reject(new Error('fallo_comanda')),
        };
      },
      disparar: h => h.boton('Imprimir Comanda').props.onClick(),
      mensaje: /Error al enviar la comanda a la impresora/,
    },
    {
      nombre: 'boleta impresa',
      crear: () => {
        const respuesta = diferida();
        return {
          overrides: { imprimirBoleta: () => respuesta.promise },
          resolver: () => respuesta.resolve(),
        };
      },
      disparar: imprimirBoleta,
      mensaje: /Boleta ##7-101 enviada a impresión térmica/,
    },
    {
      nombre: 'error al imprimir boleta',
      crear: () => {
        const respuesta = diferida();
        return {
          overrides: { imprimirBoleta: () => respuesta.promise },
          resolver: () => respuesta.reject(new Error('fallo_boleta')),
        };
      },
      disparar: imprimirBoleta,
      mensaje: /Error al enviar la boleta a impresión térmica/,
    },
    {
      nombre: 'boleta descargada',
      crear: () => {
        const respuesta = diferida();
        return {
          overrides: { guardarArchivoConUbicacion: () => respuesta.promise },
          resolver: () => respuesta.resolve({ ok: true }),
        };
      },
      disparar: h => h.boton('Descargar Boleta').props.onClick(),
      mensaje: /Boleta descargada con éxito/,
    },
    {
      nombre: 'error al descargar boleta',
      crear: () => {
        const respuesta = diferida();
        return {
          overrides: { guardarArchivoConUbicacion: () => respuesta.promise },
          resolver: () => respuesta.reject(new Error('fallo_descarga')),
        };
      },
      disparar: h => h.boton('Descargar Boleta').props.onClick(),
      mensaje: /Error al generar la boleta: fallo_descarga/,
    },
  ];

  for (const caso of casos) {
    await verificarSinFugaDeAviso(t, caso);
  }
});

test('Detalle real: abrir otro pedido durante la generación del PDF no abre el guardado de A', async t => {
  const s = crearServicios();
  const blob = diferida();
  let guardados = 0;
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, {
      guardarArchivoConUbicacion: () => {
        guardados += 1;
        return Promise.resolve({ ok: true });
      },
    }, () => blob.promise),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7), pedido(201, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Descargar Boleta').props.onClick());
  await h.completar(() => h.boton('abrir-201').props.onClick());
  await h.completar(() => blob.resolve({}));

  assert.equal(guardados, 0);
  assert.doesNotMatch(h.texto(), /Boleta descargada con éxito/);
});

test('Detalle real: cambiar de cafetería durante la generación del PDF no abre el guardado de A', async t => {
  const s = crearServicios();
  const blob = diferida();
  let guardados = 0;
  const h = crearMontaje(t, s, {
    '../../components/DetallePedidoDialog': cargarDetallePedidoDialog(s, {
      guardarArchivoConUbicacion: () => {
        guardados += 1;
        return Promise.resolve({ ok: true });
      },
    }, () => blob.promise),
  });
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  await h.completar(() => h.boton('abrir-101').props.onClick());
  await h.completar(() => h.boton('Descargar Boleta').props.onClick());
  h.cambiar(12);
  await h.completar();
  await h.completar(() => blob.resolve({}));

  assert.equal(guardados, 0);
  assert.doesNotMatch(h.texto(), /Boleta descargada con éxito/);
});

test('A→B: un snapshot A que llega tarde se descarta; si B falla, el reintento carga B', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montar(7);
  assert.equal(s.solicitudes[0].cafeteriaId, 7);

  h.cambiar(12);
  assert.equal(h.spinner(), 1);
  await h.completar();
  assert.equal(s.solicitudes[1].cafeteriaId, 12);

  await h.completar(() => s.solicitudes[1].reject(new Error('fallo_carga_B')));
  assert.match(h.texto(), /fallo_carga_B/);
  assert.equal(h.spinner(), 0);

  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  assert.doesNotMatch(h.texto(), /#7-101/);
  assert.match(h.texto(), /fallo_carga_B/);

  await h.completar(() => h.boton('Reintentar').props.onClick());
  assert.equal(s.solicitudes[2].cafeteriaId, 12);
  await h.completar(() => s.solicitudes[2].resolve([pedido(201, 12)]));
  assert.match(h.texto(), /#12-201/);
  assert.doesNotMatch(h.texto(), /fallo_carga_B/);
  assert.doesNotMatch(h.texto(), /#7-/);
});

test('Realtime B: voz solo en pedidos nuevos válidos; actualizaciones y normalización incompleta no rompen la vista', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montar(12);
  await h.completar(() => s.solicitudes[0].resolve([pedido(201, 12), pedido(202, 12)]));
  const canal = s.suscripciones[0].opciones;

  await h.completar(() => canal.onComanda(pedido(203, 12)));
  assert.deepEqual(s.anuncios.map(p => p.id), [203]);
  assert.match(h.texto(), /#12-203/);

  await h.completar(() => canal.onComanda(pedido(203, 12)));
  assert.equal(s.anuncios.length, 1, 'un duplicado no debe anunciar voz');

  await h.completar(() => canal.onComanda({ ...pedido(204, 12), cafeteria_id: undefined }));
  assert.equal(s.anuncios.length, 1);
  assert.equal(h.tarjeta(204), undefined, 'un pedido nuevo sin cafetería no se muestra');

  await h.completar(() => canal.onActualizar(pedido(203, 12, 'listo')));
  assert.equal(h.tarjeta(203).props['data-estado'], 'listo');
  assert.equal(s.anuncios.length, 1, 'un cambio de estado no debe anunciar voz');

  await h.completar(() => canal.onActualizar({ ...pedido(201, 12, 'en_preparacion'), cafeteria_id: null }));
  assert.equal(h.tarjeta(201).props['data-estado'], 'en_preparacion', 'una actualización conocida sin cafetería se aplica');

  await h.completar(() => h.boton('preparar-202').props.onClick());
  assert.equal(s.actualizaciones.length, 1);
  await h.completar(() => s.actualizaciones[0].resolve(pedido(202, 12, 'en_preparacion')));
  assert.equal(s.anuncios.length, 1, 'un cambio local no debe anunciar voz');
});

test('KDS rechaza cafeterías inválidas y usa un fallback válido del perfil', async t => {
  const casosInvalidos = [null, '', 0, -1, 1.5, true, 'invalida'];
  for (const cafeteria of casosInvalidos) {
    const s = crearServicios();
    const h = crearMontaje(t, s);
    await h.montarUsuario({ id: 5, cafeteria_id: cafeteria });
    assert.match(h.texto(), /no tiene una cafetería asociada/i);
    assert.equal(s.solicitudes.length, 0);
    assert.equal(s.suscripciones.length, 0);
  }

  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montarUsuario({ id: 5, cafeteria_id: '', cafeteriaId: 12 });
  assert.equal(s.solicitudes[0].cafeteriaId, 12);
  assert.equal(s.suscripciones[0].opciones.cafeteriaId, 12);
});

test('Realtime conserva productos visibles si una actualización llega sin detalles', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  const original = {
    ...pedido(301, 7),
    productos: [{ nombre: 'Café', cantidad: 1 }],
    detalles_pedido: [{ id: 1, cantidad: 1 }],
  };
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([original]));
  await h.completar(() => s.suscripciones[0].opciones.onActualizar({
    ...pedido(301, 7, 'en_preparacion'),
    productos: [],
    detalles_pedido: [],
  }));

  const tarjeta = h.tarjeta(301);
  assert.equal(tarjeta.props['data-estado'], 'en_preparacion');
  const modal = () => h.tree.root.findByType('detalle').props.pedido;
  await h.completar(() => h.boton('abrir-301').props.onClick());
  assert.deepEqual(modal().productos, original.productos);
  assert.deepEqual(modal().detalles_pedido, original.detalles_pedido);
});

test('Realtime: UPDATE con cafetería explícita distinta se rechaza aunque el ID sea conocido y esté en el modal', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montar(7);
  await h.completar(() => s.solicitudes[0].resolve([pedido(101, 7)]));
  const canal = s.suscripciones[0].opciones;

  await h.completar(() => h.boton('abrir-101').props.onClick());
  const modal = () => h.tree.root.findByType('detalle').props.pedido;
  assert.equal(modal().codigo_pedido, '#7-101');

  await h.completar(() => canal.onActualizar(pedido(101, 99, 'listo')));
  assert.equal(h.tarjeta(101).props['data-estado'], 'pendiente');
  assert.equal(modal().codigo_pedido, '#7-101');
  assert.equal(modal().cafeteria_id, 7);

  await h.completar(() => canal.onActualizar({ ...pedido(101, 7, 'en_preparacion'), cafeteria_id: undefined }));
  assert.equal(h.tarjeta(101).props['data-estado'], 'en_preparacion');
  assert.equal(modal().estado, 'en_preparacion');
});

test('Realtime: un INSERT que llega después de su UPDATE avisa por voz una sola vez', async t => {
  const s = crearServicios();
  const h = crearMontaje(t, s);
  await h.montar(12);
  await h.completar(() => s.solicitudes[0].resolve([]));
  const canal = s.suscripciones[0].opciones;

  await h.completar(() => canal.onActualizar(pedido(203, 12, 'en_preparacion')));
  await h.completar(() => canal.onComanda(pedido(203, 12)));
  assert.match(h.texto(), /#12-203/);
  assert.deepEqual(s.anuncios.map(comanda => comanda.id), [203]);

  await h.completar(() => canal.onComanda(pedido(203, 12)));
  assert.equal(s.anuncios.length, 1, 'un INSERT repetido no debe anunciar dos veces');
});

test('Escáner: el fallback Supabase valida contra la cafetería vigente tras un cambio', async t => {
  const llamadas = [];
  const nodo = etiqueta => props => React.createElement(etiqueta, props, props.children);
  const icono = () => React.createElement('icono');
  const muiEscanner = {
    Dialog: nodo('dialogo'), DialogTitle: nodo('titulo'), DialogContent: nodo('contenido'),
    DialogActions: nodo('acciones'), Box: nodo('caja'), Typography: nodo('texto'),
    Button: ({ children, ...props }) => React.createElement('button', props, children),
    IconButton: nodo('botonicono'), Stack: nodo('pila'), Tabs: nodo('tabs'), Tab: nodo('tab'),
    TextField: nodo('textfield'), CircularProgress: nodo('spinner'), Alert: nodo('alerta'),
  };
  const dependenciasEscanner = {
    '@mui/material': muiEscanner,
    '@mui/icons-material/Close': icono,
    '@mui/icons-material/Key': icono,
    '@mui/icons-material/QrCodeScanner': icono,
    '@mui/icons-material/VideocamOff': icono,
    '@mui/icons-material/CheckCircle': icono,
    '@mui/icons-material/WarningAmber': icono,
    '@mui/icons-material/ErrorOutlineOutlined': icono,
    '@mui/icons-material/UploadFile': icono,
    '@mui/icons-material/Refresh': icono,
    jsqr: () => null,
    '../services/backendApi': {
      __esModule: true,
      default: { validarQr: async () => { throw new Error('sin backend'); } },
    },
    '../services/pedidosService': {
      __esModule: true,
      default: {
        validarQrEntrega: (...args) => {
          llamadas.push(args);
          return { valido: false, razon: 'rechazado' };
        },
      },
      normalizarTokenQR: texto => texto,
    },
  };
  const EscanearQrDialog = cargar('components/EscanearQrDialog.jsx', dependenciasEscanner).default;
  let tree;
  t.after(() => { if (tree) act(() => tree.unmount()); });
  await act(async () => {
    tree = create(React.createElement(EscanearQrDialog, {
      open: true, cafeteriaId: 7, usuarioId: '5', onClose() {},
    }));
  });
  await completar(() => tree.update(React.createElement(EscanearQrDialog, {
    open: true, cafeteriaId: 12, usuarioId: '5', onClose() {},
  })));
  await completar(() => tree.root.findByType('tabs').props.onChange(null, 'token'));
  await completar(() => tree.root.findByType('textfield').props.onChange({ target: { value: 'QR-TST-1' } }));
  const validar = tree.root.findAllByType('button').find(b => b.children.some(c => typeof c === 'string' && c.includes('Validar Token')));
  await completar(() => validar.props.onClick());

  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0], ['QR-TST-1', '5', 12]);
});

test('Escáner: una validación pendiente no publica resultado ni suena al cerrar o cambiar de cafetería', async t => {
  const ventanaAnterior = global.window;
  let sonidos = [];
  global.window = {
    AudioContext: class {
      constructor() { sonidos.push('contexto'); }
      get currentTime() { return 0; }
      get destination() { return {}; }
      createOscillator() {
        return {
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}, start() { sonidos.push('sonido'); }, stop() {},
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        };
      }
    },
  };
  t.after(() => { global.window = ventanaAnterior; });

  const nodo = etiqueta => props => React.createElement(etiqueta, props, props.children);
  const icono = () => React.createElement('icono');
  const muiEscanner = {
    Dialog: nodo('dialogo'), DialogTitle: nodo('titulo'), DialogContent: nodo('contenido'),
    DialogActions: nodo('acciones'), Box: nodo('caja'), Typography: nodo('texto'),
    Button: ({ children, ...props }) => React.createElement('button', props, children),
    IconButton: nodo('botonicono'), Stack: nodo('pila'), Tabs: nodo('tabs'), Tab: nodo('tab'),
    TextField: nodo('textfield'), CircularProgress: nodo('spinner'), Alert: nodo('alerta'),
  };

  for (const cerrar of [false, true]) {
    sonidos = [];
    const validacion = diferida();
    const llamadas = [];
    const dependenciasEscanner = {
      '@mui/material': muiEscanner,
      '@mui/icons-material/Close': icono,
      '@mui/icons-material/Key': icono,
      '@mui/icons-material/QrCodeScanner': icono,
      '@mui/icons-material/VideocamOff': icono,
      '@mui/icons-material/CheckCircle': icono,
      '@mui/icons-material/WarningAmber': icono,
      '@mui/icons-material/ErrorOutlineOutlined': icono,
      '@mui/icons-material/UploadFile': icono,
      '@mui/icons-material/Refresh': icono,
      jsqr: () => null,
      '../services/backendApi': {
        __esModule: true,
        default: { validarQr: () => validacion.promise },
      },
      '../services/pedidosService': {
        __esModule: true,
        default: {
          validarQrEntrega: (...args) => {
            llamadas.push(args);
            return { valido: false, razon: 'rechazado' };
          },
        },
        normalizarTokenQR: texto => texto,
      },
    };
    const EscanearQrDialog = cargar('components/EscanearQrDialog.jsx', dependenciasEscanner).default;
    let tree;
    t.after(() => { if (tree) act(() => tree.unmount()); });
    await act(async () => {
      tree = create(React.createElement(EscanearQrDialog, {
        open: true, cafeteriaId: 7, usuarioId: '5', onClose() {},
      }));
    });
    await completar(() => tree.root.findByType('tabs').props.onChange(null, 'token'));
    await completar(() => tree.root.findByType('textfield').props.onChange({ target: { value: 'QR-TARDE' } }));
    const validar = tree.root.findAllByType('button').find(b =>
      b.children.some(c => typeof c === 'string' && c.includes('Validar Token')));
    await completar(() => validar.props.onClick());
    await completar(() => tree.update(React.createElement(EscanearQrDialog, {
      open: !cerrar, cafeteriaId: cerrar ? 7 : 12, usuarioId: '5', onClose() {},
    })));
    await completar(() => validacion.resolve({ valido: true }));

    assert.equal(llamadas.length, 0);
    assert.equal(sonidos.length, 0, 'una respuesta atrasada no debe reproducir sonido');
    assert.doesNotMatch(textoRenderizado(tree.toJSON()), /Entrega Validada Exitosamente/);
  }
});

test('StrictMode: setup→cleanup→setup conserva el montaje, carga la cafetería y procesa eventos', async t => {
  const { DOMParser } = require('@xmldom/xmldom');
  const { createRoot } = require('react-dom/client');
  const actReact = React.act;

  const documento = new DOMParser().parseFromString('<div id="root"></div>', 'text/xml');
  const contenedor = documento.getElementById('root');
  const prototipo = Object.getPrototypeOf(contenedor);
  prototipo.addEventListener = prototipo.removeEventListener = () => {};
  prototipo.style = {};
  documento.addEventListener = documento.removeEventListener = () => {};
  documento.createElement = documento.createElement.bind(documento);
  const anterior = {
    document: global.document,
    window: global.window,
    actEnvironment: global.IS_REACT_ACT_ENVIRONMENT,
  };
  global.document = documento;
  global.window = { document: documento, HTMLIFrameElement: class HTMLIFrameElement {} };
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const s = crearServicios();
  const tarjetas = [];
  const dependenciasStrict = dependencias(s);
  dependenciasStrict['../../components/PedidoCard'] = ({ pedido, onOpen, onChangeEstado }) => {
    tarjetas.push({ pedido, onOpen, onChangeEstado });
    return React.createElement('pedidocard', { 'data-id': String(pedido.id) }, pedido.codigo_pedido);
  };
  const Comandas = cargar('pages/empleado/Comandas.jsx', dependenciasStrict).default;
  let root;
  t.after(() => {
    if (root) actReact(() => root.unmount());
    global.document = anterior.document;
    global.window = anterior.window;
    global.IS_REACT_ACT_ENVIRONMENT = anterior.actEnvironment;
  });

  await actReact(async () => {
    root = createRoot(contenedor);
    root.render(React.createElement(React.StrictMode, null,
      React.createElement(Comandas, { currentUser: { id: 5, cafeteria_id: 7 } })));
  });

  assert.equal(s.solicitudes.length, 2, 'StrictMode debe repetir setup→cleanup→setup');
  assert.equal(s.suscripciones.length, 2);
  assert.equal(s.suscripciones[0].cerrada, true);
  assert.equal(s.suscripciones[1].cerrada, false);

  await actReact(async () => {
    s.solicitudes.forEach(solicitud => solicitud.resolve([pedido(101, 7)]));
  });
  assert.match(contenedor.textContent, /#7-101/);

  await actReact(async () => {
    s.suscripciones[1].opciones.onComanda(pedido(102, 7));
  });
  assert.match(contenedor.textContent, /#7-102/);
  assert.deepEqual(s.anuncios.map(comanda => comanda.id), [102]);

  const tarjeta = tarjetas.find(item => String(item.pedido.id) === '101');
  await actReact(async () => { tarjeta.onChangeEstado(101, 'en_preparacion'); });
  assert.equal(s.actualizaciones.length, 1);
  assert.equal(s.actualizaciones[0].estado, 'en_preparacion');
});

test('kdsRealtime no publica callbacks que terminan después de cerrar', async () => {
  const callbacks = {};
  const cafeterias = diferida();
  const supabase = {
    channel() {
      return {
        on(_tipo, filtro, callback) { callbacks[filtro.event] = callback; return this; },
        subscribe() { return this; },
        unsubscribe() {},
      };
    },
    removeChannel() {},
    from(tabla) {
      if (tabla === 'cafeterias') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => cafeterias.promise }) }) };
      }
      return { select: () => ({ eq: async () => ({ data: [{ id: 1 }], error: null }) }) };
    },
  };
  const publicados = [];
  const { kdsRealtime } = cargar('services/kdsRealtime.js', {
    './supabaseClient.js': { supabase, isSupabaseConfigured: true },
    './pedidosService': { normalizarPedido: fila => fila },
  }, 'js');
  const suscripcion = kdsRealtime.suscribir({
    cafeteriaId: 7,
    onComanda: comanda => publicados.push(['comanda', comanda.id]),
    onActualizar: comanda => publicados.push(['actualizar', comanda.id]),
  });
  const insercion = callbacks.INSERT({ new: { id: 301, cafeteria_id: 7, estado: 'pendiente' } });
  const actualizacion = callbacks.UPDATE({ new: { id: 302, cafeteria_id: 7, estado: 'listo' } });
  suscripcion.cerrar();
  cafeterias.resolve({ data: null });
  await Promise.all([insercion, actualizacion]);
  assert.deepEqual(publicados, []);
});
