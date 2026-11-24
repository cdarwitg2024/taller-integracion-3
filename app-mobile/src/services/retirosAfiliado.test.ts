import { consultarRetirosAfiliado } from './retirosAfiliado';
import { supabase } from '../lib/supabase';
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { refreshSession: jest.fn() } } }));
const referencia = 'f876c63c-83b4-4705-9046-c11122223333';
const retiro = { id: 1, monto_clp: 300, creado_en: '2026-11-23T12:00:00Z', referencia };
const range = jest.fn();
const query = { select: jest.fn(), order: jest.fn(), range };
beforeEach(() => {
  jest.clearAllMocks(); range.mockReset();
  (supabase.from as jest.Mock).mockReturnValue(query);
  query.select.mockReturnValue(query); query.order.mockReturnValue(query);
});
test('lee solo el historial propio por RLS, sin ejecutar retiros ni inventar comprobantes históricos', async () => {
  range.mockResolvedValue({ data: [retiro, { ...retiro, id: 2, referencia: null }], count: 2 });
  expect(await consultarRetirosAfiliado()).toEqual([retiro, { ...retiro, id: 2, referencia: null }]);
  expect(supabase.from).toHaveBeenCalledWith('retiros_afiliado');
  expect(query.select).toHaveBeenCalledWith('id,monto_clp,creado_en,referencia', { count: 'exact' });
  expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
});
test('recupera tres retiros aunque PostgREST limite cada página a dos filas', async () => {
  const filas = [retiro, { ...retiro, id: 2, referencia: referencia.slice(0, -1) + '4' },
    { ...retiro, id: 3, referencia: referencia.slice(0, -1) + '5' }];
  range.mockResolvedValueOnce({ data: filas.slice(0, 2), count: 3 })
    .mockResolvedValueOnce({ data: filas.slice(2), count: 3 });
  expect(await consultarRetirosAfiliado()).toEqual(filas);
  expect(range.mock.calls).toEqual([[0, 199], [2, 201]]);
});
test('vacío confirmado por el servidor', async () => {
  range.mockResolvedValue({ data: [], count: 0 });
  expect(await consultarRetirosAfiliado()).toEqual([]);
});
test.each([
  { data: [], count: 1 }, { data: [retiro], count: null }, { data: null, count: 0 },
  { data: [retiro, retiro], count: 2 }, { data: [retiro], count: 0 },
])('rechaza un historial incompleto o duplicado: %j', async respuesta => {
  range.mockResolvedValue(respuesta);
  await expect(consultarRetirosAfiliado()).rejects.toThrow();
});
test('un cambio del total entre páginas exige actualizar en lugar de publicar un parcial', async () => {
  range.mockResolvedValueOnce({ data: [retiro], count: 2 }).mockResolvedValueOnce({ data: [{ ...retiro, id: 2 }], count: 3 });
  await expect(consultarRetirosAfiliado()).rejects.toThrow('historial completo');
});
test.each([{ monto_clp: 0 }, { monto_clp: -1 }, { monto_clp: '300' }, { monto_clp: Number.MAX_SAFE_INTEGER + 1 },
  { creado_en: 'ayer' }, { referencia: undefined }, { referencia: 'comprobante-inventado' }, { id: 0 },
])('no publica campos inválidos: %j', async campos => {
  range.mockResolvedValue({ data: [{ ...retiro, ...campos }], count: 1 });
  await expect(consultarRetirosAfiliado()).rejects.toThrow('respuesta de retiros');
});
test.each([['42501', 403], ['PGRST301', 401], ['28000', 401], ['PGRST204', 503]])(
  'distingue el error %s como %s', async (code, status) => {
    range.mockResolvedValue({ error: { code } });
    await expect(consultarRetirosAfiliado()).rejects.toMatchObject({ status });
  });
test('renueva una sesión vencida una vez y recupera las filas mediante el SDK', async () => {
  range.mockResolvedValueOnce({ error: { code: 'PGRST303', message: 'JWT expired' } })
    .mockResolvedValueOnce({ data: [retiro], count: 1 });
  (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'local-test' } } });
  expect(await consultarRetirosAfiliado()).toEqual([retiro]);
  expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 503])('conserva HTTP %s cuando el rechazo no incluye código PostgREST', async status => {
  range.mockResolvedValue({ status, data: null, count: null, error: { message: 'Rechazo sin código' } });
  await expect(consultarRetirosAfiliado()).rejects.toMatchObject({ status });
});

test.each([401, 403])('HTTP %s impide publicar filas incluso si la respuesta no incluye error', async status => {
  range.mockResolvedValue({ status, data: [retiro], count: 1, error: null });
  await expect(consultarRetirosAfiliado()).rejects.toMatchObject({ status });
});
