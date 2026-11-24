'use strict';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@coffeefaster/shared/src/supabase', () => ({
  obtenerCliente: () => ({ auth: { getUser: mockGetUser } }),
}));

const { createClient } = require('@supabase/supabase-js');
const request = require('supertest');
const app = require('../src/app');
const mockGetUser = jest.fn();
const rpc = jest.fn();
const ruta = '/api/afiliados/saldo';
const hacerConsulta = (url = ruta) => request(app).get(url).set('Authorization', 'Bearer sesion');

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test';
  createClient.mockReset().mockReturnValue({ rpc });
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'uuid-estudiante' } } });
  rpc.mockReset();
});

test.each([500, 0, -500])('devuelve el saldo disponible %i usando la sesión del estudiante', async disponible => {
  const saldo = { pendiente_clp: 0, disponible_clp: disponible, retirado_clp: 0 };
  rpc.mockResolvedValue({ data: [saldo], error: null });
  await hacerConsulta().expect('Cache-Control', 'no-store').expect(200, saldo);
  expect(rpc).toHaveBeenCalledWith('consultar_saldo_afiliado');
  expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'publishable-test',
    expect.objectContaining({ global: { headers: { Authorization: 'Bearer sesion' } } }));
});

test('rechaza consultas sin sesión o con parámetros de identidad antes de llamar a Supabase RPC', async () => {
  await request(app).get(ruta).expect(401);
  await hacerConsulta(`${ruta}?estudiante_id=11`).expect(400);
  expect(rpc).not.toHaveBeenCalled();
});

test.each([
  ['42501', 403], ['PGRST301', 401], ['PGRST303', 401], ['28000', 401], ['PGRST202', 503],
])('traduce el error de RPC %s a HTTP %i', async (code, status) => {
  rpc.mockResolvedValue({ data: null, error: { code } });
  await hacerConsulta().expect(status);
});

test.each([
  { data: null }, { data: [] }, { data: [{}, {}] }, { data: [{ pendiente_clp: null }] },
])('rechaza una respuesta de saldo inválida (%j)', async respuesta => {
  rpc.mockResolvedValue(respuesta);
  await hacerConsulta().expect(503);
});
