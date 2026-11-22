import { consultarSaldoAfiliado } from './saldoAfiliado';
import { supabase } from '../lib/supabase';
jest.mock('../lib/supabase', () => ({ supabase: {
  rpc: jest.fn(), from: jest.fn(), auth: { getSession: jest.fn(), refreshSession: jest.fn() },
} }));
const rpc = supabase.rpc as jest.Mock;
const saldo = { pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 };
beforeEach(() => { jest.clearAllMocks(); rpc.mockReset(); });

test('V12 consulta el saldo global con el JWT del SDK sin enviar identidad ni afiliación', async () => {
  rpc.mockResolvedValue({ data: [saldo], error: null });
  expect(await consultarSaldoAfiliado()).toEqual(saldo);
  expect(rpc).toHaveBeenCalledWith('consultar_saldo_afiliado');
  expect(supabase.from).not.toHaveBeenCalled();
});
test('un estudiante sin movimientos conserva los ceros confirmados por el servidor', async () => {
  rpc.mockResolvedValue({ data: [{ pendiente_clp: 0, disponible_clp: 0, retirado_clp: 0 }], error: null });
  expect(await consultarSaldoAfiliado()).toEqual({ pendiente_clp: 0, disponible_clp: 0, retirado_clp: 0 });
});
test('el disponible negativo de V12 no se convierte artificialmente a cero', async () => {
  rpc.mockResolvedValue({ data: [{ ...saldo, disponible_clp: -500 }], error: null });
  expect((await consultarSaldoAfiliado()).disponible_clp).toBe(-500);
});
test.each([null, [], [saldo, saldo], [{}], [{ ...saldo, retirado_clp: null }],
  [{ ...saldo, disponible_clp: '700' }], [{ ...saldo, pendiente_clp: -1 }],
  [{ ...saldo, retirado_clp: -1 }], [{ ...saldo, disponible_clp: Number.MAX_SAFE_INTEGER + 1 }],
])('una respuesta incompleta o no representable no se publica como saldo: %j', async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(consultarSaldoAfiliado()).rejects.toThrow('confirmar el saldo completo');
});
test.each([['42501', 403], ['PGRST301', 401], ['28000', 401], ['PGRST202', 503]])(
  'error RPC %s conserva el estado HTTP %s, sin fallback a sumas locales', async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'fallo controlado' } });
    await expect(consultarSaldoAfiliado()).rejects.toMatchObject({ status });
    expect(supabase.from).not.toHaveBeenCalled();
  });
