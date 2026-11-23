import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartProvider, useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Input from '../components/Input';
import CartScreen from './CartScreen';

jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));

const producto = { id: 41, name: 'Café', price: 9000, quantity: 1, cafeteriaId: 7 };
const gateway = 'http://gateway-prueba';
const respuesta = (subtotal, descuento_afiliado, total) => ({
  ok: true, status: 200, text: async () => JSON.stringify({ subtotal, descuento_afiliado, total }),
});
const fallo = (status, error) => ({ ok: false, status, text: async () => JSON.stringify({ error }) });
const importe = monto => `$${monto.toLocaleString('es-CL')}`;
let tree;
let cartera;
let transporte;
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;

function Carrito({ usuarioId }) {
  cartera = useCart();
  return <CartScreen usuarioId={usuarioId} cart={cartera.cart} idCarrito={cartera.idCarrito}
    codigo={cartera.codigo} onCodigoChange={cartera.setCodigo} onCheckout={jest.fn()} />;
}

async function montar(usuarioId = 'comprador') {
  await act(async () => {
    tree = TestRenderer.create(<CartProvider><Carrito usuarioId={usuarioId} /></CartProvider>);
  });
}
const texto = () => tree.root.findAllByType(Text).map(n => [].concat(n.props.children).join('')).join(' | ');
const boton = titulo => tree.root.findAllByType(Button).find(n => n.props.title === titulo);
const pulsar = titulo => act(async () => boton(titulo).props.onPress());
const escribir = codigo => act(async () => tree.root.findByType(Input).props.onChangeText(codigo));
const solicitudes = () => transporte.mock.calls.map(([, opciones]) => JSON.parse(opciones.body));

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@coffeefast/cart', JSON.stringify([producto]));
  process.env.EXPO_PUBLIC_API_URL = gateway;
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-prueba' } } });
  transporte = jest.fn();
  global.fetch = transporte;
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
});

test('cotiza sin código, muestra los tres importes exactos al aplicar y recotiza al quitar', async () => {
  transporte.mockResolvedValueOnce(respuesta(10000, 0, 10000))
    .mockResolvedValueOnce(respuesta(10000, 1500, 8500))
    .mockResolvedValueOnce(respuesta(11000, 0, 11000));
  await montar();
  expect(texto()).toContain(importe(10000));
  await escribir(' NORTE ');
  expect(transporte).toHaveBeenCalledTimes(1);
  await pulsar('Aplicar');
  expect(texto()).toContain(`Descuento de afiliado | ${importe(1500)}`);
  expect(texto()).toContain(`Total cotizado | IVA incluido | ${importe(8500)}`);
  expect(texto()).toContain(importe(10000));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retirar lo antes posible' }).props.onPress());
  expect(boton('Proceder al Pago').props.disabled).toBe(true);
  await pulsar('Quitar');
  expect(texto()).toContain(`Descuento de afiliado | ${importe(0)}`);
  expect(texto()).toContain(`Total cotizado | IVA incluido | ${importe(11000)}`);
  expect(texto()).not.toContain(importe(8500));
  expect(boton('Proceder al Pago').props.disabled).toBe(false);
  const base = { cafeteria_id: 7, items: [{ producto_id: 41, cantidad: 1 }] };
  expect(solicitudes()).toEqual([base, { ...base, codigo: 'NORTE' }, base]);
  expect(transporte.mock.calls[0][0]).toBe(`${gateway}/api/afiliados/cotizaciones`);
  expect(transporte.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-prueba');
});

test('cambiar de cafetería descarta la cotización y el código aunque la respuesta llegue tarde', async () => {
  let terminar;
  transporte.mockResolvedValueOnce(respuesta(10000, 0, 10000))
    .mockImplementationOnce(() => new Promise(resolve => { terminar = resolve; }))
    .mockResolvedValueOnce(respuesta(12000, 0, 12000));
  await montar();
  await escribir('NORTE');
  await pulsar('Aplicar');
  await act(async () => cartera.setCart([{ ...producto, id: 42, cafeteriaId: 8 }]));
  await act(async () => terminar(respuesta(10000, 1500, 8500)));
  expect(solicitudes().at(-1)).toEqual({ cafeteria_id: 8, items: [{ producto_id: 42, cantidad: 1 }] });
  expect(texto()).toContain(importe(12000));
  expect(texto()).not.toContain(importe(8500));
  expect(texto()).toContain('Sin código seleccionado');
});

test.each([
  [422, 'codigo_invalido', 'El código no es válido para esta cafetería.'],
  [422, 'codigo_desactivado', 'El código está inactivo o su campaña no está disponible.'],
  [422, 'campana_pausada', 'El código está inactivo o su campaña no está disponible.'],
  [422, 'beneficio_usado', 'Ya usaste este beneficio y no puedes aplicarlo otra vez.'],
  [422, 'motivo_nuevo', 'Este código no se puede aplicar a tu carrito.'],
  [503, 'cotizacion_afiliada_no_disponible', 'No se pudo obtener la cotización.'],
])('HTTP %s con %s muestra su mensaje y permite seguir sin código', async (status, motivo, mensaje) => {
  transporte.mockResolvedValueOnce(respuesta(10000, 0, 10000))
    .mockResolvedValueOnce(fallo(status, motivo)).mockResolvedValueOnce(respuesta(11000, 0, 11000));
  await montar();
  await escribir('NORTE');
  await pulsar('Aplicar');
  expect(texto()).toContain('Total estimado');
  expect(texto()).not.toContain('Total cotizado');
  expect(texto()).toContain(mensaje);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retirar lo antes posible' }).props.onPress());
  expect(boton('Proceder al Pago').props.disabled).toBe(true);
  await pulsar('Quitar');
  expect(texto()).toContain(importe(11000));
  expect(texto()).toContain(`Descuento de afiliado | ${importe(0)}`);
  expect(texto()).not.toContain(mensaje);
  expect(boton('Proceder al Pago').props.disabled).toBe(false);
  expect(solicitudes().at(-1)).not.toHaveProperty('codigo');
});

test('corregir un código rechazado retira el aviso y permite cotizar el nuevo código', async () => {
  transporte.mockResolvedValueOnce(respuesta(10000, 0, 10000))
    .mockResolvedValueOnce(fallo(422, 'codigo_invalido'))
    .mockResolvedValueOnce(respuesta(10000, 0, 10000))
    .mockResolvedValueOnce(respuesta(10000, 1500, 8500));
  await montar();
  await escribir('NORET');
  await pulsar('Aplicar');
  expect(texto()).toContain('El código no es válido');
  await escribir('NORTE');
  expect(texto()).not.toContain('El código no es válido');
  await pulsar('Aplicar');
  expect(solicitudes().at(-1).codigo).toBe('NORTE');
  expect(texto()).toContain(importe(8500));
});
