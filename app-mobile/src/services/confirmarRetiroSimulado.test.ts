import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { confirmarRetiroSimulado, consultarIntentoRetiro, prepararOtroRetiro } from './confirmarRetiroSimulado';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
const cuenta = 'estudiante-a';
const recibo = { monto_clp: 500, estado: 'confirmado', referencia: '00000000-0000-4000-8000-000000000999',
  destino: 'Cuenta de prueba CoffeeFast (destino ficticio)', disponible_clp: 200 };
const storageKey = `@coffeefast/intento-retiro/${cuenta}`;
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
let transporte: jest.Mock;
const respuesta = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks();
  let n = 0;
  (randomUUID as jest.Mock).mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'jwt-a', user: { id: cuenta } } } });
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  transporte = jest.fn(async () => respuesta(recibo)); global.fetch = transporte;
});
afterEach(() => { jest.restoreAllMocks(); global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
});
const confirmar = () => confirmarRetiroSimulado(cuenta, 500);
const cuerpo = (n = 0) => JSON.parse(transporte.mock.calls[n][1].body);
test('persiste antes del POST y repite el mismo cuerpo después de perder la respuesta', async () => {
  transporte.mockImplementationOnce(async () => {
    expect(JSON.parse((await AsyncStorage.getItem(storageKey))!)).toMatchObject({ monto: 500, clave: cuerpo().clave_idempotencia });
    throw new Error('respuesta perdida después de persistir en el servidor');
  });
  await expect(confirmar()).rejects.toMatchObject({ resultadoIncierto: true });
  await expect(confirmar()).resolves.toEqual(recibo);
  expect(cuerpo(1)).toEqual(cuerpo());
  expect(transporte.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt-a');
  expect(randomUUID).toHaveBeenCalledTimes(1);
  expect(await consultarIntentoRetiro(cuenta)).toMatchObject({ monto: 500, comprobante: recibo });
});
test.each([503, 409])('HTTP %i conserva clave y bloquea cambiar monto o iniciar otro intento', async status => {
  transporte.mockResolvedValueOnce(respuesta({ error: 'resultado_no_confirmado' }, status));
  await expect(confirmar()).rejects.toMatchObject({ status });
  await expect(confirmarRetiroSimulado(cuenta, 100)).rejects.toThrow('Recupera el retiro pendiente');
  await expect(prepararOtroRetiro(cuenta)).rejects.toThrow('Primero recupera');
  await confirmar(); expect(cuerpo(1)).toEqual(cuerpo());
});
test('otra instancia del módulo recupera la clave persistida', async () => {
  transporte.mockRejectedValueOnce(new Error('sin respuesta'));
  await expect(confirmar()).rejects.toThrow();
  let nueva!: typeof confirmarRetiroSimulado;
  jest.isolateModules(() => { nueva = require('./confirmarRetiroSimulado').confirmarRetiroSimulado; });
  await nueva(cuenta, 500); expect(cuerpo(1)).toEqual(cuerpo());
});
test('el bloqueo evita dos POST simultáneos', async () => {
  let resolver!: (value: any) => void;
  transporte.mockImplementationOnce(() => new Promise(ok => { resolver = ok; }));
  const primero = confirmar();
  await expect(confirmar()).rejects.toThrow('en proceso');
  while (!resolver) await new Promise(resolve => setTimeout(resolve, 0));
  resolver(respuesta(recibo)); await primero;
  expect(transporte).toHaveBeenCalledTimes(1);
});
test('un comprobante guardado no vuelve a enviar; otro retiro explícito renueva la clave', async () => {
  await confirmar(); await confirmar(); expect(transporte).toHaveBeenCalledTimes(1);
  await prepararOtroRetiro(cuenta); await confirmar();
  expect(cuerpo(1).clave_idempotencia).not.toBe(cuerpo().clave_idempotencia);
});
test('otra cuenta no lee ni envía el intento anterior', async () => {
  transporte.mockRejectedValueOnce(new Error('sin respuesta'));
  await expect(confirmar()).rejects.toThrow();
  expect(await consultarIntentoRetiro('estudiante-b')).toBeNull();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'jwt-b', user: { id: 'estudiante-b' } } } });
  await expect(confirmar()).rejects.toThrow('La sesión no corresponde');
  expect(transporte).toHaveBeenCalledTimes(1);
});
test('fallo de persistencia previo al envío impide el POST', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disco lleno'));
  await expect(confirmar()).rejects.toThrow('No pudimos guardar'); expect(transporte).not.toHaveBeenCalled();
});
test('si guardar el comprobante falla, conserva la clave enviada', async () => {
  const original = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(original).mockRejectedValueOnce(new Error('disco lleno'));
  await expect(confirmar()).rejects.toThrow('No pudimos guardar');
  await confirmar(); expect(cuerpo(1)).toEqual(cuerpo());
});
test('un registro dañado bloquea otro envío', async () => {
  await AsyncStorage.setItem(storageKey, '{');
  await expect(confirmar()).rejects.toThrow('No pudimos recuperar');
  expect(transporte).not.toHaveBeenCalled(); expect(randomUUID).not.toHaveBeenCalled();
});
test.each([{}, { ...recibo, monto_clp: 501 }, { ...recibo, referencia: 'invalida' }])('respuesta incompleta conserva el intento (%j)', async body => {
  transporte.mockResolvedValueOnce(respuesta(body));
  await expect(confirmar()).rejects.toThrow('No pudimos confirmar el comprobante');
  await confirmar(); expect(cuerpo(1)).toEqual(cuerpo());
});
test('el rechazo definitivo de saldo libera el monto para corregirlo', async () => {
  transporte.mockResolvedValueOnce(respuesta({ error: 'saldo_insuficiente' }, 422));
  await expect(confirmar()).rejects.toMatchObject({ status: 422 });
  expect(await consultarIntentoRetiro(cuenta)).toBeNull();
});

test('un timeout conserva el intento para recuperar con la misma clave', async () => {
  transporte.mockRejectedValueOnce(Object.assign(new Error('abortado'), { name: 'AbortError' }));
  await expect(confirmar()).rejects.toMatchObject({ resultadoIncierto: true });
  await confirmar(); expect(cuerpo(1)).toEqual(cuerpo());
});
