import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { obtenerIntentoCompra, reiniciarIntentoCompra, consultarIntentoPendiente } from './intentoCompra';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
const usuario = 'comprador-persistencia';
const llave = `@coffeefast/intento-compra/${usuario}`;
const cuerpo = { cafeteria_id: 7, items: [{ producto_id: 41, cantidad: 1 }], franja_retiro: '12:00-12:15' };

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  let numero = 0;
  (randomUUID as jest.Mock).mockImplementation(() => `uuid-${++numero}`);
});

test('el vaciado invalida un intento no enviado sin depender de removeItem ni de memoria anterior', async () => {
  const anterior = await obtenerIntentoCompra(usuario, cuerpo);
  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('remove falló'));
  await reiniciarIntentoCompra(usuario, true);
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(JSON.parse((await AsyncStorage.getItem(llave))!).invalidado).toBe(true);
  let recuperar!: typeof obtenerIntentoCompra;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
    jest.doMock('expo-crypto', () => ({ randomUUID }));
    recuperar = require('./intentoCompra').obtenerIntentoCompra;
  });
  expect((await recuperar(usuario, cuerpo)).clave).not.toBe(anterior.clave);
});

test('el reinicio espera la escritura y comunica un fallo en vez de afirmar que terminó', async () => {
  await obtenerIntentoCompra(usuario, cuerpo);
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disco lleno'));
  await expect(reiniciarIntentoCompra(usuario)).rejects.toMatchObject({ codigo: 'almacenamiento' });
  expect(JSON.parse((await AsyncStorage.getItem(llave))!).clave).toBe('uuid-1');
  await reiniciarIntentoCompra(usuario);
  expect(await consultarIntentoPendiente(usuario)).toBe(false);
});

test('un registro previo sin estado se considera pendiente y no una compra nueva', async () => {
  const original = JSON.stringify({ firma: JSON.stringify(cuerpo), clave: 'clave-previa' });
  await AsyncStorage.setItem(llave, original);
  await reiniciarIntentoCompra(usuario, true);
  expect(await AsyncStorage.getItem(llave)).toBe(original);
  expect(await consultarIntentoPendiente(usuario)).toBe(true);
});
