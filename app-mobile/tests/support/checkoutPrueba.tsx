import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import App from '../../App';
import CartScreen from '../../src/screens/CartScreen';
import Button from '../../src/components/Button';
import MenuScreen from '../../src/screens/MenuScreen';
import { CafeteriaListScreen } from '../../src/screens/CafeteriaListScreen';
import { supabase } from '../../src/lib/supabase';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../../src/screens/MenuScreen', () => () => null);
jest.mock('../../src/screens/CafeteriaListScreen', () => ({ CafeteriaListScreen: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }) },
  from: jest.fn(),
} }));

export const producto = { id: 41, name: 'Café', price: 2500, quantity: 1,
  cafeteriaId: 7, cafeteriaNombre: 'Norte', available: true };
export const retiro = { franja: '12:30-12:45' };
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
export let tree: ReactTestRenderer, transporte: jest.Mock, disponibilidad: jest.Mock;
export let cotizar: jest.Mock;
export const confirmar = () => tree.root.findByType(CartScreen).props.onCheckout(retiro);
export const claves = () => transporte.mock.calls.map(([, opciones]) => opciones.headers['Idempotency-Key']);
export async function pagarDesdePantalla() {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retirar lo antes posible' }).props.onPress());
  await act(async () => { await tree.root.findAllByType(Button)
    .find(nodo => nodo.props.title === 'Proceder al Pago')!.props.onPress(); });
}
export async function pestaña(nombre: string) {
  await act(async () => tree.root.findAllByType(TouchableOpacity).find(nodo =>
    nodo.props.accessibilityRole === 'tab' && nodo.props.accessibilityLabel.startsWith(nombre))!.props.onPress());
  act(() => jest.advanceTimersByTime(150));
}
export async function agregarOtraCompra(nuevo = producto) {
  await pestaña('Cafeterías');
  if (tree.root.findAllByType(CafeteriaListScreen).length) {
    await act(async () => tree.root.findByType(CafeteriaListScreen).props.onSelectCafeteria({ id: 7, nombre: 'Norte' }));
  }
  await act(async () => tree.root.findByType(MenuScreen).props.onAddToCart(nuevo, { id: 7, nombre: 'Norte' }));
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
  cotizar = jest.fn(async () => ({ ok: false, status: 503,
    text: async () => JSON.stringify({ error: 'cotizacion_afiliada_no_disponible' }) }));
  global.fetch = (url, opciones) => String(url).endsWith('/api/afiliados/cotizaciones')
    ? cotizar(url, opciones) : transporte(url, opciones);
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


export { act, Alert, Text, AsyncStorage, randomUUID, CartScreen };
