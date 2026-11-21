import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { crearPedidoDesdeCarrito } from './crearPedidoDesdeCarrito';
import { reiniciarIntentoCompra } from './intentoCompra';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
const productos = [{ id: 41, quantity: 1, price: 2500 }];
const retiro = { franja: '12:30-12:45', codigo: 'NORTE' };
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
let transporte: jest.Mock;
const enviar = (usuario = 'comprador-a') => crearPedidoDesdeCarrito(7, productos, retiro, 15000, usuario);
const claves = () => transporte.mock.calls.map(([, opciones]) => opciones.headers['Idempotency-Key']);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  let numero = 0;
  (randomUUID as jest.Mock).mockImplementation(() => `00000000-0000-4000-8000-${String(++numero).padStart(12, '0')}`);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'jwt-ficticio' } } });
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  transporte = jest.fn(async () => ({ ok: true, status: 201,
    text: async () => JSON.stringify({ pedido: { ok: true, pedido_id: 501 } }) }));
  global.fetch = transporte;
});
afterEach(() => {
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
});

test('dos solicitudes simultáneas conservan una clave persistida antes del transporte', async () => {
  await Promise.all([enviar(), enviar()]);
  expect(new Set(claves()).size).toBe(1);
  expect(randomUUID).toHaveBeenCalledTimes(1);
  const guardado = JSON.parse((await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-a'))!);
  expect(guardado.clave).toBe(claves()[0]);
  expect(transporte.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-ficticio');
});

test('respuesta perdida y reintento manual conservan la misma clave y cuerpo', async () => {
  transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
  await expect(enviar()).rejects.toMatchObject({ resultadoIncierto: true });
  await enviar();
  expect(claves()[1]).toBe(claves()[0]);
  expect(transporte.mock.calls[1][1].body).toBe(transporte.mock.calls[0][1].body);
});

test('otra instancia recupera la clave desde almacenamiento, sin memoria del módulo anterior', async () => {
  await enviar();
  let recuperar!: typeof import('./intentoCompra').obtenerIntentoCompra;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
    recuperar = require('./intentoCompra').obtenerIntentoCompra;
  });
  const cuerpo = JSON.parse(transporte.mock.calls[0][1].body);
  const recuperado = await recuperar('comprador-a', { ...cuerpo, franja_retiro: '12:45-13:00' });
  expect(recuperado.clave).toBe(claves()[0]);
  expect(recuperado.cuerpo).toEqual(cuerpo);
});

test.each(['cantidad', 'cafetería', 'precio', 'código'])(
  'otra confirmación con distinto %s recibe otra clave', async cambio => {
    await enviar();
    await crearPedidoDesdeCarrito(cambio === 'cafetería' ? 12 : 7,
      [{ ...productos[0], quantity: cambio === 'cantidad' ? 2 : 1, price: cambio === 'precio' ? 3000 : 2500 }],
      { ...retiro, codigo: cambio === 'código' ? 'SUR' : retiro.codigo }, 15000, 'comprador-a');
    expect(claves()[1]).not.toBe(claves()[0]);
  });

test('cambiar solo la franja automática conserva la clave y el cuerpo originales', async () => {
  transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
  await expect(enviar()).rejects.toMatchObject({ resultadoIncierto: true });
  await crearPedidoDesdeCarrito(7, productos, { ...retiro, franja: '12:45-13:00' }, 15000, 'comprador-a');
  expect(claves()[1]).toBe(claves()[0]);
  expect(transporte.mock.calls[1][1].body).toBe(transporte.mock.calls[0][1].body);
});

test('vaciar o confirmar la compra permite otra idéntica con una clave nueva', async () => {
  await enviar();
  await reiniciarIntentoCompra('comprador-a');
  await enviar();
  expect(claves()[1]).not.toBe(claves()[0]);
});

test('cada cuenta conserva su intento por separado', async () => {
  await enviar('comprador-a');
  await enviar('comprador-b');
  await enviar('comprador-a');
  expect(claves()[1]).not.toBe(claves()[0]);
  expect(claves()[2]).toBe(claves()[0]);
});

test('si no puede persistir la clave, no envía el pedido', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disco no disponible'));
  await expect(enviar()).rejects.toMatchObject({ codigo: 'almacenamiento' });
  expect(transporte).not.toHaveBeenCalled();
});

test('espera a que la escritura termine antes de enviar el pedido', async () => {
  const guardar = AsyncStorage.setItem as jest.Mock;
  const original = guardar.getMockImplementation()!;
  let liberar!: () => void, entro!: () => void;
  const escritura = new Promise<void>(resolve => { liberar = resolve; });
  const inicio = new Promise<void>(resolve => { entro = resolve; });
  guardar.mockImplementationOnce(async (...args) => {
    entro();
    await escritura;
    return original(...args);
  });
  const compra = enviar();
  await inicio;
  expect(transporte).not.toHaveBeenCalled();
  liberar();
  await compra;
  expect(transporte).toHaveBeenCalledTimes(1);
});

test('timeout y reintento conservan la clave original', async () => {
  jest.useFakeTimers();
  let entro!: () => void;
  const inicio = new Promise<void>(resolve => { entro = resolve; });
  transporte.mockImplementationOnce((_, opciones) => new Promise((resolve, reject) => {
    opciones.signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })));
    entro();
  }));
  const compra = enviar();
  const rechazo = expect(compra).rejects.toMatchObject({ resultadoIncierto: true });
  await inicio;
  jest.advanceTimersByTime(15000);
  await rechazo;
  await enviar();
  expect(claves()[1]).toBe(claves()[0]);
  jest.useRealTimers();
});

test.each(['{ilegible', 'null'])('un intento dañado (%s) no genera otra clave ni envía una compra a ciegas', async guardado => {
  await AsyncStorage.setItem('@coffeefast/intento-compra/comprador-a', guardado);
  await expect(enviar()).rejects.toThrow();
  expect(randomUUID).not.toHaveBeenCalled();
  expect(transporte).not.toHaveBeenCalled();
});
