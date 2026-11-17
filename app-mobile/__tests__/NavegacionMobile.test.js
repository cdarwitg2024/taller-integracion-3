import React from 'react';
import { Alert, BackHandler, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { supabase } from '../src/lib/supabase';
import { apiGet, apiPost } from '../src/services/backendClient';
import { CafeteriaListScreen } from '../src/screens/CafeteriaListScreen';
import MenuScreen from '../src/screens/MenuScreen';
import CartScreen from '../src/screens/CartScreen';
import PerfilScreen from '../src/screens/PerfilScreen';
import MisAfiliacionesScreen from '../src/screens/MisAfiliacionesScreen';
import Header from '../src/components/Header';
import Button from '../src/components/Button';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// El menú se sustituye en su frontera: aquí se verifica quién lo abre y
// cómo conecta sus acciones al carrito, no su consulta de productos/stock.
jest.mock('../src/screens/MenuScreen', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('../src/services/backendClient', () => ({
  apiGet: jest.fn(), apiPost: jest.fn(), ApiError: class extends Error {},
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(),
  },
}));

const session = { user: { id: 'auth-navegacion-t1', email: 't1@example.test' } };
const norte = { id: 7, nombre: 'Cafetería Norte T1' };
const sur = { id: 12, nombre: 'Cafetería Sur T1' };
const cafe = { id: 41, name: 'Café T1', price: 1000, available: true, iconName: 'mug' };
let tree;
let handlers;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  handlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((evento, handler) => {
    handlers.push(handler);
    return { remove: () => { handlers = handlers.filter(actual => actual !== handler); } };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  apiGet.mockResolvedValue({ data: [norte, sur] });
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  supabase.from.mockImplementation(tabla => {
    const consulta = {
      select: jest.fn(() => consulta), or: jest.fn(() => consulta),
      eq: jest.fn(() => consulta), order: jest.fn(() => consulta),
      maybeSingle: jest.fn(async () => ({ data: tabla === 'usuarios' ? {
        id: 901, auth_user_id: session.user.id, email: session.user.email,
        nombre: 'Estudiante', apellido: 'T1', rol_id: 1, roles: { nombre: 'estudiante' },
      } : null, error: null })),
      limit: jest.fn(async () => ({ data: [], error: null })),
    };
    return consulta;
  });
  supabase.channel.mockImplementation(() => {
    const canal = { on: jest.fn(() => canal), subscribe: jest.fn(() => canal) };
    return canal;
  });
  await act(async () => { tree = create(<App />); });
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const tabs = () => tree.root.findAllByType(TouchableOpacity)
  .filter(nodo => nodo.props.accessibilityRole === 'tab');
async function irA(nombre) {
  await act(async () => tabs().find(nodo => nodo.props.accessibilityLabel.startsWith(nombre)).props.onPress());
  act(() => jest.advanceTimersByTime(160));
}
async function seleccionar(indice = 0) {
  await act(async () => tree.root.findAllByType(Button)
    .filter(nodo => nodo.props.title === 'Ver Menu')[indice].props.onPress());
}
const agregar = (producto = cafe) => act(() => {
  const menu = tree.root.findByType(MenuScreen);
  menu.props.onAddToCart(producto, menu.props.cafeteria);
});
async function abrirAfiliaciones() {
  await irA('Perfil');
  await act(async () => tree.root.findAllByType(TouchableOpacity)
    .find(nodo => nodo.props.accessibilityLabel === 'Mis afiliaciones').props.onPress());
}
async function atrasAndroid() {
  let consumido = false;
  await act(async () => {
    for (const handler of [...handlers].reverse()) {
      if (handler()) { consumido = true; break; }
    }
  });
  return consumido;
}

test('catálogo → menú → carrito → menú conserva cafetería y productos en una sola barra', async () => {
  expect(apiGet).toHaveBeenCalledWith('/api/cafeterias', { publico: true });
  expect(tabs().map(nodo => nodo.props.accessibilityLabel))
    .toEqual(['Cafeterías', 'Pedidos', 'Carrito', 'Wallet', 'Perfil']);
  await seleccionar();
  expect(tree.root.findByType(MenuScreen).props.cafeteria).toEqual(norte);
  agregar();
  await irA('Carrito');
  expect(tree.root.findByType(CartScreen).props.cart)
    .toEqual([expect.objectContaining({ id: 41, cafeteriaId: 7, quantity: 1 })]);
  await act(async () => tree.root.findByType(CartScreen).findByType(Header).props.onBack());
  act(() => jest.advanceTimersByTime(160));
  expect(tree.root.findByType(MenuScreen).props.cafeteria).toEqual(norte);
  await irA('Cafeterías');
  expect(tree.root.findAllByType(CafeteriaListScreen)).toHaveLength(0);
});

test.each(['botón', 'flecha', 'Android'])('Mis afiliaciones vuelve por %s sin alterar sesión, menú ni carrito', async regreso => {
  await seleccionar();
  agregar();
  await abrirAfiliaciones();
  expect(tree.root.findByType(PerfilScreen).props.session).toBe(session);
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(1);
  expect(tabs()).toHaveLength(5);
  expect(tabs().find(nodo => nodo.props.accessibilityLabel === 'Perfil').props.accessibilityState.selected).toBe(true);
  if (regreso === 'Android') expect(await atrasAndroid()).toBe(true);
  else await act(async () => {
    const seccion = tree.root.findByType(MisAfiliacionesScreen);
    if (regreso === 'flecha') seccion.findByType(Header).props.onBack();
    else seccion.findByType(Button).props.onPress();
  });
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(0);
  expect(tree.root.findByType(PerfilScreen).props.session).toBe(session);
  await irA('Cafeterías');
  expect(tree.root.findByType(MenuScreen).props.cafeteria).toEqual(norte);
  await irA('Carrito');
  expect(tree.root.findByType(CartScreen).props.cart)
    .toEqual([expect.objectContaining({ id: 41, cafeteriaId: 7, quantity: 1 })]);
  expect(apiPost).not.toHaveBeenCalled();
});

test('visitar otra cafetería no cambia el carrito; reemplazarlo exige la confirmación existente', async () => {
  await seleccionar();
  agregar();
  await act(async () => tree.root.findByType(MenuScreen).props.onBack());
  await seleccionar(1);
  agregar({ ...cafe, id: 42 });
  const opciones = Alert.alert.mock.calls.at(-1)[2];
  expect(opciones.map(opcion => opcion.text)).toEqual(['Cancelar', 'Vaciar y agregar']);
  await irA('Carrito');
  expect(tree.root.findByType(CartScreen).props.cart[0].cafeteriaId).toBe(7);
  await irA('Cafeterías');
  expect(tree.root.findByType(MenuScreen).props.cafeteria).toEqual(sur);
  agregar({ ...cafe, id: 42 });
  act(() => Alert.alert.mock.calls.at(-1)[2].find(opcion => opcion.text === 'Vaciar y agregar').onPress());
  await irA('Carrito');
  expect(tree.root.findByType(CartScreen).props.cart)
    .toEqual([expect.objectContaining({ id: 42, cafeteriaId: 12, quantity: 1 })]);
});

test('Atrás conserva el orden carrito → menú → listado → sistema', async () => {
  await seleccionar();
  agregar();
  await irA('Carrito');
  expect(await atrasAndroid()).toBe(true);
  expect(tree.root.findByType(MenuScreen).props.cafeteria).toEqual(norte);
  expect(await atrasAndroid()).toBe(true);
  expect(tree.root.findAllByType(CafeteriaListScreen)).toHaveLength(1);
  expect(await atrasAndroid()).toBe(false);
});
