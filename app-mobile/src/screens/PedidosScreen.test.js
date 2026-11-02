import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import PedidosScreen from './PedidosScreen';
import Button from '../components/Button';
import QrCode from '../lib/QrCode';
import { apiGet, ApiError } from '../services/backendClient';
import { supabase } from '../lib/supabase';

jest.mock('../lib/QrCode', () => jest.fn(() => null));
jest.mock('../services/backendClient', () => {
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  return { apiGet: jest.fn(), apiPatch: jest.fn(), ApiError };
});
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

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
  const list = tree.root.findByType(FlatList);
  const card = list.props.renderItem({ item: list.props.data[0] });
  await flush(() => card.props.onPress());
};
const montar = async () => { await flush(() => { tree = TestRenderer.create(<PedidosScreen userId="uuid-auth" />); }); };

beforeEach(() => {
  jest.useFakeTimers(); rows = [pedido]; queryError = null; events = {}; filters = [];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const channel = { on: jest.fn((_, config, handler) => { events[config.event] = handler; return channel; }), subscribe: jest.fn(() => channel) };
  supabase.channel.mockReturnValue(channel);
  supabase.from.mockImplementation(() => {
    const query = { select: jest.fn(() => query), eq: jest.fn((...args) => { filters.push(args); return query; }),
      maybeSingle: jest.fn(async () => ({ data: { id: 17 }, error: null })),
      order: jest.fn(async () => ({ data: rows, error: queryError })) };
    return query;
  });
  apiGet.mockImplementation(async path => path.endsWith('/qr') ? { qr_token: 'qr-servidor-completo' } : { token: '842517' });
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });

test('abre inmediatamente QR completo y token persistidos sin consultar otro servicio', async () => {
  await montar();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  await abrir();
  expect(apiGet).not.toHaveBeenCalled();
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(supabase.from).toHaveBeenCalledWith('usuarios');
  expect(supabase.from).toHaveBeenCalledWith('pedidos');
  expect(filters).toContainEqual(['auth_user_id', 'uuid-auth']);
  expect(filters).toContainEqual(['usuario_id', 17]);
  expect(textos()).toContain('842517');
});

test('muestra contingencia aunque el QR no esté disponible', async () => {
  rows = [{ ...pedido, qr_token: null }];
  await montar(); await abrir();
  expect(tree.root.findAllByType(QrCode)).toHaveLength(0);
  expect(textos()).toContain('842517');
});

test('sin conexión conserva únicamente credenciales reales de la fila', async () => {
  apiGet.mockRejectedValue(new ApiError('Sin conexión', 0));
  await montar(); await abrir();
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(textos()).toContain('842517');
});

test('sin credenciales persistidas no inventa QR ni token', async () => {
  rows = [{ ...pedido, qr_token: null, codigo_retiro_diario: null }];
  apiGet.mockRejectedValue(new ApiError('Sin conexión', 0));
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

test.each([401, 403, 404])('servicio adicional con error %s no bloquea credenciales del pedido propio', async status => {
  apiGet.mockRejectedValue(new ApiError('No autorizado', status));
  await montar(); await abrir();
  expect(tree.root.findByType(QrCode).props.value).toBe(pedido.qr_token);
  expect(textos()).toContain('842517');
  expect(apiGet).not.toHaveBeenCalled();
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
  expect(apiGet).not.toHaveBeenCalled();
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
