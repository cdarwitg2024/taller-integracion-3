import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartProvider, useCart } from './CartContext';
import CartScreen from '../screens/CartScreen';
import Input from '../components/Input';
import Button from '../components/Button';
import { crearPedidoDesdeCarrito } from '../services/crearPedidoDesdeCarrito';
import { apiPost } from '../services/backendClient';

jest.mock('../services/backendClient', () => ({ apiPost: jest.fn() }));
jest.mock('../services/intentoCompra', () => ({
  obtenerIntentoCompra: async (_, cuerpo) => ({ clave: 'intento-prueba', cuerpo }),
  marcarIntentoEnviado: async () => {},
}));
const producto = (cafeteriaId = 7) => ({
  id: cafeteriaId * 10, cafeteriaId, name: 'Café de prueba', price: 10000, quantity: 1,
});
const cotizacion = { subtotal: 10000, descuento_afiliado: 1500, total: 8500 };
let estado, tree;

function CarritoActivo({ visible }) {
  estado = useCart();
  return visible ? <CartScreen cart={estado.cart} codigo={estado.codigo}
    onCodigoChange={estado.setCodigo} idCarrito={estado.idCarrito}
    onCheckout={(retiro) => crearPedidoDesdeCarrito(estado.cafeteriaId, estado.cart, retiro, 15000, 'comprador-prueba')} /> : null;
}
const vista = (visible = true) => <CartProvider><CarritoActivo visible={visible} /></CartProvider>;
const texto = () => tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join(' ');
const escribir = (valor) => act(() => tree.root.findByType(Input).props.onChangeText(valor));
const pulsar = (titulo) => act(() => tree.root.findAllByType(Button)
  .find(nodo => nodo.props.title === titulo).props.onPress());
const aplicarCodigo = () => { escribir('NORTE'); pulsar('Aplicar'); };
const cotizar = () => act(() => estado.guardarCotizacion(cotizacion, estado.revision));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await act(async () => { tree = create(vista()); });
  act(() => estado.setCart([producto()]));
});
afterEach(() => act(() => tree.unmount()));

test('salir y volver conserva el código y la cotización del carrito activo', () => {
  aplicarCodigo();
  cotizar();
  act(() => tree.update(vista(false)));
  act(() => tree.update(vista()));
  expect(estado.cafeteriaId).toBe(7);
  expect(estado.cotizacion).toEqual(cotizacion);
  expect(texto()).toContain('Código seleccionado: NORTE');
  expect(tree.root.findByType(Input).props.value).toBe('NORTE');
});

test('cambiar de cafetería limpia código, entrada y cotización antes del checkout', async () => {
  aplicarCodigo();
  cotizar();
  act(() => estado.setCart([producto(12)]));
  expect(estado.cafeteriaId).toBe(12);
  expect(estado.codigo).toBe('');
  expect(estado.cotizacion).toBeNull();
  expect(tree.root.findByType(Input).props.value).toBe('');
  expect(texto()).toContain('Sin código seleccionado');
  act(() => tree.root.findByProps({ accessibilityLabel: 'Retirar lo antes posible' }).props.onPress());
  await act(async () => tree.root.findAllByType(Button)
    .find(nodo => nodo.props.title === 'Proceder al Pago').props.onPress());
  expect(apiPost.mock.calls[0][1]).toMatchObject({ cafeteria_id: 12 });
  expect(apiPost.mock.calls[0][1]).not.toHaveProperty('codigo');
});

test('cambiar de cafetería descarta también un borrador sin aplicar', () => {
  escribir('BORRADOR NORTE');
  act(() => estado.setCart([producto(12)]));
  expect(tree.root.findByType(Input).props.value).toBe('');
});

test('volver a la cafetería anterior no restaura su código ni una cotización tardía', () => {
  aplicarCodigo();
  const revisionAnterior = estado.revision;
  act(() => {
    estado.setCart([producto(12)]);
    estado.setCart([producto()]);
    estado.guardarCotizacion(cotizacion, revisionAnterior);
  });
  expect(estado.cafeteriaId).toBe(7);
  expect(estado.codigo).toBe('');
  expect(estado.cotizacion).toBeNull();
  cotizar();
  expect(estado.cotizacion).toEqual(cotizacion);
});

test('vaciar y crear otro carrito de la misma cafetería limpia el estado en un solo render', () => {
  aplicarCodigo();
  cotizar();
  const idAnterior = estado.idCarrito;
  act(() => { estado.clearCart(); estado.setCart([producto()]); });
  expect(estado.idCarrito).not.toBe(idAnterior);
  expect(estado.codigo).toBe('');
  expect(estado.cotizacion).toBeNull();
  expect(tree.root.findByType(Input).props.value).toBe('');
});

test('cambiar cantidades conserva el código de la cafetería e invalida la cotización', () => {
  aplicarCodigo();
  cotizar();
  const revisionAnterior = estado.revision;
  act(() => estado.setCart(cart => cart.map(item => ({ ...item, quantity: 2 }))));
  expect(estado.codigo).toBe('NORTE');
  expect(estado.cotizacion).toBeNull();
  act(() => estado.guardarCotizacion(cotizacion, revisionAnterior));
  expect(estado.cotizacion).toBeNull();
});

test.each(['editar', 'quitar'])('%s el código invalida la cotización y sus respuestas pendientes', (accion) => {
  aplicarCodigo();
  cotizar();
  const revisionAnterior = estado.revision;
  if (accion === 'editar') escribir('OTRO');
  else pulsar('Quitar');
  act(() => estado.guardarCotizacion(cotizacion, revisionAnterior));
  expect(estado.codigo).toBe('');
  expect(estado.cotizacion).toBeNull();
});

test('al retirar el último producto se limpia el código y no se acepta una cotización anterior', () => {
  aplicarCodigo();
  const revisionAnterior = estado.revision;
  act(() => estado.setCart(cart => cart.filter(item => item.id !== producto().id)));
  act(() => estado.guardarCotizacion(cotizacion, revisionAnterior));
  expect(estado.cafeteriaId).toBeNull();
  expect(estado.codigo).toBe('');
  expect(estado.cotizacion).toBeNull();
  expect(texto()).toContain('Tu carrito está vacío');
});
