import { leerConRenovacion, vincularRenovacion } from './sesion';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { auth: { refreshSession: jest.fn() } } }));
const vencido = { code: 'PGRST303', message: 'JWT expired' };
beforeEach(() => jest.clearAllMocks());

test('una lectura con JWT vencido renueva y ejecuta realmente la consulta otra vez', async () => {
  const consultar = jest.fn().mockResolvedValueOnce({ data: null, error: vencido })
    .mockResolvedValueOnce({ data: [{ id: 52 }], error: null });
  supabase.auth.refreshSession.mockResolvedValue({ data: { session: { access_token: 'nuevo' } }, error: null });
  expect((await leerConRenovacion(consultar)).data).toEqual([{ id: 52 }]);
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
});

test('si el segundo intento sigue vencido no entra en un bucle', async () => {
  const consultar = jest.fn().mockResolvedValue({ data: null, error: vencido });
  supabase.auth.refreshSession.mockResolvedValue({ data: { session: { access_token: 'nuevo' } }, error: null });
  expect((await leerConRenovacion(consultar)).error).toBe(vencido);
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
});

test('una renovación rechazada no devuelve un éxito ni reintenta la consulta', async () => {
  const consultar = jest.fn().mockResolvedValue({ error: vencido });
  supabase.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('Refresh token inválido') });
  await expect(leerConRenovacion(consultar)).rejects.toThrow('Refresh token inválido');
  expect(consultar).toHaveBeenCalledTimes(1);
});

test('un error de red no se confunde con una sesión vencida', async () => {
  const respuesta = { data: null, error: { message: 'Network request failed' } };
  const consultar = jest.fn().mockResolvedValue(respuesta);
  expect(await leerConRenovacion(consultar)).toBe(respuesta);
  expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
});

test('consultas concurrentes comparten la renovación', async () => {
  let resolver;
  supabase.auth.refreshSession.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  const a = jest.fn().mockResolvedValueOnce({ error: vencido }).mockResolvedValue({ data: [1] });
  const b = jest.fn().mockResolvedValueOnce({ error: vencido }).mockResolvedValue({ data: [2] });
  const primero = leerConRenovacion(a), segundo = leerConRenovacion(b);
  await Promise.resolve();
  expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  resolver({ data: { session: { access_token: 'nuevo' } }, error: null });
  expect(await Promise.all([primero, segundo])).toEqual([{ data: [1] }, { data: [2] }]);
});

test('al volver a primer plano activa la renovación y elimina el listener al salir', () => {
  const auth = { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
  const remove = jest.fn();
  let cambiar;
  const appState = { currentState: 'active', addEventListener: jest.fn((_, fn) => { cambiar = fn; return { remove }; }) };
  const limpiar = vincularRenovacion(auth, appState);
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
  cambiar('background'); expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  cambiar('active'); expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  limpiar(); expect(remove).toHaveBeenCalledTimes(1);
  expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(2);
});
