import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, FlatList, Modal, Text, TouchableOpacity } from 'react-native';
import PedidosScreen from './PedidosScreen';
import Button from '../components/Button';
import QrCode from '../lib/QrCode';
import { apiPatch, ApiError } from '../services/backendClient';
import { supabase } from '../lib/supabase';

jest.mock('../lib/QrCode', () => jest.fn(() => null));
jest.mock('../services/backendClient', () => ({
  ...jest.requireActual('../services/backendClient'), apiPatch: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(), rpc: jest.fn(), auth: { refreshSession: jest.fn() } } }));

const pedido = {
  id: 52, estado: 'Pendiente', total: 6000, codigo_pedido: 'REAL-52',
  qr_token: 'qr-persistido-completo', codigo_retiro_diario: '842517',
  creado_en: '2026-11-01T12:00:00Z', cafeterias: { nombre: 'Central' },
  detalles_pedido: [{ cantidad: 3, precio_unitario: 2000, subtotal: 6000, productos: { nombre: 'Café' } }],
};
let rows, queryError, tree, events, filters;
const flush = async (fn = () => {}) => { await act(async () => { await fn(); }); };
const textos = () => tree.root.findAllByType(Text).map(n => [].concat(n.props.children).join('')).join(' | ');
const abrir = async () => {
  const card = tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel?.startsWith('Ver pedido '));
  await flush(() => card.props.onPress());
};
const montar = async () => { await flush(() => { tree = TestRenderer.create(<PedidosScreen userId="uuid-auth" />); }); };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }); rows = [pedido]; queryError = null; events = {}; filters = [];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const channel = { on: jest.fn((_, config, handler) => { events[config.event] = handler; return channel; }), subscribe: jest.fn(() => channel) };
  supabase.channel.mockReturnValue(channel);
  supabase.from.mockImplementation(() => {
    const query = { select: jest.fn(() => query), eq: jest.fn((...args) => { filters.push(args); return query; }),
      maybeSingle: jest.fn(async () => ({ data: { id: 17 }, error: null })),
      order: jest.fn(async () => ({ data: rows, error: queryError })) };
    return query;
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });

test('abre inmediatamente QR completo y token persistidos sin consultar otro servicio', async () => {
  await montar();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  const consultas = supabase.from.mock.calls.length;
  await abrir();
  expect(supabase.from).toHaveBeenCalledTimes(consultas);
  expect(apiPatch).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(supabase.from).toHaveBeenCalledWith('usuarios');
  expect(supabase.from).toHaveBeenCalledWith('pedidos');
  expect(filters).toContainEqual(['auth_user_id', 'uuid-auth']);
  expect(filters).toContainEqual(['usuario_id', 17]);
  expect(textos()).toContain('842517');
});

test('permite abrir y cerrar repetidamente usando un único modal nativo', async () => {
  await montar();
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  for (let i = 0; i < 5; i++) {
    await abrir();
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
    expect(textos()).toContain('842517');
    await flush(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  }
});

test('cerrar confirmación permite abrir el detalle en el mismo modal', async () => {
  const confirmado = { pedido_id: 52, total: 6000, saldo_restante: 4000,
    estado: 'pendiente', qr_token: pedido.qr_token, codigo_retiro: '842517' };
  const cerrarConfirmacion = jest.fn(() => tree.update(<PedidosScreen userId="uuid-auth" />));
  await flush(() => { tree = TestRenderer.create(<PedidosScreen userId="uuid-auth"
    pedidoConfirmado={confirmado} onConfirmacionVista={cerrarConfirmacion} />); });
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  await flush(() => tree.root.findAllByType(Button).find(n => n.props.title === 'Ver mis pedidos').props.onPress());
  expect(cerrarConfirmacion).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  await abrir();
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
});

test('muestra contingencia aunque el QR no esté disponible', async () => {
  rows = [{ ...pedido, qr_token: null }];
  await montar(); await abrir();
  expect(tree.root.findAllByType(QrCode)).toHaveLength(0);
  expect(textos()).toContain('842517');
});

test('sin conexión conserva únicamente credenciales reales de la fila', async () => {
  await montar(); await abrir();
  queryError = new Error('Sin conexión');
  await flush(() => tree.root.findByType(FlatList).props.onRefresh());
  expect(textos()).toContain('No pudimos cargar tus pedidos');
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(textos()).toContain('842517');
});

test('sin credenciales persistidas no inventa QR ni token', async () => {
  rows = [{ ...pedido, qr_token: null, codigo_retiro_diario: null }];
  await montar(); await abrir();
  expect(tree.root.findAllByType(QrCode)).toHaveLength(0);
  expect(textos()).not.toContain('CF-52');
  expect(textos()).toContain('Este pedido no tiene un QR de retiro guardado.');
  expect(textos()).toContain('Este pedido no tiene un token de contingencia guardado.');
});

test('un fallo al actualizar conserva los pedidos ya cargados', async () => {
  await montar();
  queryError = new Error('Sin conexión');
  await flush(() => tree.root.findByType(FlatList).props.onRefresh());
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  expect(tree.root.findByType(FlatList).props.refreshing).toBe(false);
  expect(textos()).toContain('No pudimos cargar tus pedidos');
});

test.each([401, 403, 404])('cancelación no informa éxito si API y RPC rechazan con error %s', async status => {
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  apiPatch.mockRejectedValue(new ApiError('No autorizado', status));
  supabase.rpc.mockResolvedValue({ data: null, error: new Error('Operación rechazada') });
  await montar(); await abrir();
  await flush(() => tree.root.findAllByType(Button).find(n => n.props.title === 'Cancelar pedido y reembolsar').props.onPress());
  const opciones = alerta.mock.calls.find(([titulo]) => titulo === 'Cancelar pedido')[2];
  await flush(() => opciones.find(o => o.style === 'destructive').onPress());
  expect(apiPatch).toHaveBeenCalledWith('/api/pedidos/52/estado', { estado: 'cancelado' }, { timeoutMs: 7000 });
  expect(supabase.rpc).toHaveBeenCalledWith('cancelar_pedido', { p_pedido_id: 52 });
  expect(alerta.mock.calls.some(([titulo]) => titulo === 'Error al cancelar')).toBe(true);
  expect(alerta.mock.calls.some(([titulo]) => titulo === '¡Pedido cancelado!')).toBe(false);
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
});

test('un conflicto real de cancelación no reintenta mediante RPC ni anuncia reembolso', async () => {
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  apiPatch.mockRejectedValue(new ApiError('no_cancelable', 409));
  await montar(); await abrir();
  await flush(() => tree.root.findAllByType(Button).find(n => n.props.title === 'Cancelar pedido y reembolsar').props.onPress());
  const opciones = alerta.mock.calls.find(([titulo]) => titulo === 'Cancelar pedido')[2];
  await flush(() => opciones.find(o => o.style === 'destructive').onPress());
  expect(apiPatch).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(alerta.mock.calls.some(([titulo]) => titulo === 'No es posible cancelar')).toBe(true);
  expect(alerta.mock.calls.some(([titulo]) => titulo === '¡Pedido cancelado!')).toBe(false);
});

test('un error de consulta ofrece reintento en lugar de afirmar que no hay pedidos', async () => {
  queryError = new Error('Conexión interrumpida');
  await montar();
  expect(textos()).toContain('No pudimos cargar tus pedidos');
  queryError = null;
  await flush(() => tree.root.findAllByType(Button).find(n => n.props.title === 'Reintentar').props.onPress());
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  expect(textos()).not.toContain('No pudimos cargar tus pedidos');
});

test('recupera pedidos y abre el QR tras renovar un JWT vencido', async () => {
  queryError = { code: 'PGRST303', message: 'JWT expired' };
  supabase.auth.refreshSession.mockImplementation(async () => {
    queryError = null;
    return { data: { session: { access_token: 'renovado' } }, error: null };
  });
  await montar();
  expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  await abrir();
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(textos()).toContain('842517');
});

test('actualiza por gesto y Realtime; entregado pasa al historial sin credenciales', async () => {
  await montar(); await abrir();
  rows = [{ ...pedido, estado: 'Listo' }];
  await flush(() => tree.root.findByType(FlatList).props.onRefresh());
  expect(tree.root.findByType(FlatList).props.data[0].estado).toBe('listo');
  await flush(() => events.UPDATE({ new: { ...pedido, estado: 'Entregado' } }));
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(0);
  expect(tree.root.findAllByType(QrCode)).toHaveLength(0);
  expect(textos()).not.toContain('842517');
  expect(textos()).toContain('Pedido entregado');
});

test('historial abre comprobante sin solicitar QR ni contingencia', async () => {
  rows = [{ ...pedido, estado: 'entregado' }];
  await montar();
  const tab = tree.root.findAllByType(TouchableOpacity).find(n => n.findAllByType(Text).some(t => [].concat(t.props.children).join('') === 'Inactivos (1)'));
  await flush(() => tab.props.onPress());
  await abrir();
  expect(apiPatch).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(textos()).toContain('Pedido entregado');
});

test('actualizaciones parciales de Realtime conservan QR y token del pedido abierto', async () => {
  await montar(); await abrir();
  await flush(() => events.UPDATE({ new: { id: 52, estado: 'Listo' } }));
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(textos()).toContain('842517');
});

test('una sesión sin perfil interno no consulta ni muestra pedidos', async () => {
  supabase.from.mockImplementation(() => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
    return query;
  });
  await montar();
  expect(supabase.from).not.toHaveBeenCalledWith('pedidos');
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(0);
  expect(textos()).not.toContain('842517');
});
