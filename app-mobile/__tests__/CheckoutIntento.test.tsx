import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import App from '../App';
import CartScreen from '../src/screens/CartScreen';
import Button from '../src/components/Button';
import MenuScreen from '../src/screens/MenuScreen';
import { CafeteriaListScreen } from '../src/screens/CafeteriaListScreen';
import { supabase } from '../src/lib/supabase';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../src/screens/MenuScreen', () => () => null);
jest.mock('../src/screens/CafeteriaListScreen', () => ({ CafeteriaListScreen: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }) },
  from: jest.fn(),
} }));

const producto = { id: 41, name: 'Café', price: 2500, quantity: 1,
  cafeteriaId: 7, cafeteriaNombre: 'Norte', available: true };
const retiro = { franja: '12:30-12:45' };
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
let tree: ReactTestRenderer, transporte: jest.Mock, disponibilidad: jest.Mock;
const confirmar = () => tree.root.findByType(CartScreen).props.onCheckout(retiro);
const claves = () => transporte.mock.calls.map(([, opciones]) => opciones.headers['Idempotency-Key']);
async function pagarDesdePantalla() {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retirar lo antes posible' }).props.onPress());
  await act(async () => { await tree.root.findAllByType(Button)
    .find(nodo => nodo.props.title === 'Proceder al Pago')!.props.onPress(); });
}
async function pestaña(nombre: string) {
  await act(async () => tree.root.findAllByType(TouchableOpacity).find(nodo =>
    nodo.props.accessibilityRole === 'tab' && nodo.props.accessibilityLabel.startsWith(nombre))!.props.onPress());
  act(() => jest.advanceTimersByTime(150));
}
async function agregarOtraCompra() {
  await pestaña('Cafeterías');
  await act(async () => tree.root.findByType(CafeteriaListScreen).props.onSelectCafeteria({ id: 7, nombre: 'Norte' }));
  await act(async () => tree.root.findByType(MenuScreen).props.onAddToCart(producto, { id: 7, nombre: 'Norte' }));
  await pestaña('Carrito');
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 20, 12, 14));
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@coffeefast/cart', JSON.stringify([producto]));
  let numero = 0;
  (randomUUID as jest.Mock).mockImplementation(() => `00000000-0000-4000-8000-${String(++numero).padStart(12, '0')}`);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {
    user: { id: 'comprador-app', email: 'comprador@example.test' }, access_token: 'jwt-prueba',
  } } });
  disponibilidad = jest.fn(async () => ({ data: [{ id: 41, cafeteria_id: 7, activo: true,
    eliminado_en: null, stock: 20 }], error: null }));
  (supabase.from as jest.Mock).mockImplementation(() => ({ select: () => ({ in: disponibilidad }) }));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  transporte = jest.fn(async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ pedido: null }) }));
  global.fetch = transporte;
  await act(async () => { tree = create(<App />); });
  await pestaña('Carrito');
});
afterEach(async () => {
  await act(async () => tree.unmount());
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('App bloquea el doble toque antes de otro render y conserva la clave en el reintento', async () => {
  transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
  const checkout = tree.root.findByType(CartScreen).props.onCheckout;
  await act(async () => { await Promise.all([checkout(retiro), checkout(retiro)]); });
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(1);
  await act(async () => { await confirmar(); });
  expect(claves()).toHaveLength(2);
  expect(claves()[1]).toBe(claves()[0]);
});

test('App confirma el pedido y otra compra idéntica recibe una clave nueva', async () => {
  transporte.mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify({ pedido: {
    ok: true, pedido_id: 501, total: 2500, saldo_restante: 7500,
  } }) });
  await pagarDesdePantalla();
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  act(() => jest.advanceTimersByTime(120000));
  await agregarOtraCompra();
  await pagarDesdePantalla();
  expect(claves()[1]).not.toBe(claves()[0]);
  expect(JSON.parse(transporte.mock.calls[1][1].body).franja_retiro).toBe('12:15-12:30');
});

test.each(['respuesta perdida', 'respuesta incompleta'])(
  'pantalla real: %s y cambio automático de franja conservan clave y cuerpo', async caso => {
    if (caso === 'respuesta perdida') transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
    await pagarDesdePantalla();
    const original = transporte.mock.calls[0][1];
    expect(JSON.parse(original.body).franja_retiro).toBe('12:00-12:15');
    act(() => jest.advanceTimersByTime(120000));
    expect(tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join(' '))
      .toContain('12:15 - 12:30');
    await pagarDesdePantalla();
    expect(claves()[1]).toBe(claves()[0]);
    expect(transporte.mock.calls[1][1].body).toBe(original.body);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

test('retirar el último producto y crear otro carrito renueva la clave aunque los datos coincidan', async () => {
  await act(async () => { await confirmar(); });
  await act(async () => tree.root.findByType(CartScreen).props.onRemove(41));
  await agregarOtraCompra();
  await act(async () => { await confirmar(); });
  expect(claves()[1]).not.toBe(claves()[0]);
});

test('un fallo de disponibilidad libera el bloqueo para el siguiente intento', async () => {
  disponibilidad.mockResolvedValueOnce({ data: null, error: { message: 'consulta fallida' } });
  await act(async () => { await confirmar(); });
  expect(transporte).not.toHaveBeenCalled();
  await act(async () => { await confirmar(); });
  expect(transporte).toHaveBeenCalledTimes(1);
});
