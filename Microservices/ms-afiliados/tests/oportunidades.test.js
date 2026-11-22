'use strict';

// HTTP real de Express/Supertest; Auth y RPC de Supabase están simulados.
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@coffeefaster/shared/src/supabase', () => ({
  obtenerCliente: () => ({ auth: { getUser: mockGetUser } }),
}));
const { createClient } = require('@supabase/supabase-js');
const request = require('supertest');
const app = require('../src/app');
const rpc = jest.fn();
const mockGetUser = jest.fn();
const getUser = mockGetUser;
const ruta = '/api/afiliados/cafeterias/7/campanas';
const campana = {
  id: 31, nombre: 'Semana del café', cafeteria_id: 7,
  cafeteria_nombre: 'Cafetería A', tipo: 'carrito_completo', estado: 'activa',
  vigencia_desde: '2026-11-01T00:00:00Z', vigencia_hasta: '2026-12-01T00:00:00Z',
  tasa_descuento: 12.5, tasa_comision: 8, estado_vigencia: 'en_curso',
};
const entornoAnterior = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test';
  createClient.mockClear();
  createClient.mockReturnValue({ auth: { getUser }, rpc });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'uuid-estudiante' } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: [campana], error: null });
});

afterAll(() => { process.env = entornoAnterior; });

test('la cotización afiliada está deshabilitada por defecto y no llama a la RPC', async () => {
  delete process.env.HABILITAR_CONFIRMACION_AFILIADA;
  await request(app).post('/api/afiliados/cotizaciones')
    .set('Authorization', 'Bearer sesion-estudiante')
    .send({ cafeteria_id: 7, items: [{ producto_id: 41, cantidad: 1 }], codigo: 'DIEGO-PROMO1' })
    .expect(503, { error: 'cotizacion_afiliada_no_disponible' });
  expect(rpc).not.toHaveBeenCalled();
});

test('la cotización afiliada habilitada consulta V06 con la sesión del comprador', async () => {
  process.env.HABILITAR_CONFIRMACION_AFILIADA = 'true';
  const items = [{ producto_id: 41, cantidad: 1 }];
  const cotizacion = { subtotal: 10000, descuento_afiliado: 1500, total: 8500 };
  rpc.mockResolvedValue({ data: [{ ...cotizacion, motivo: null }], error: null });

  await request(app).post('/api/afiliados/cotizaciones')
    .set('Authorization', 'Bearer sesion-estudiante')
    .send({ cafeteria_id: 7, items, codigo: 'DIEGO-PROMO1' })
    .expect(200, cotizacion);
  expect(rpc).toHaveBeenCalledWith('cotizar_carrito_afiliado', {
    p_cafeteria_id: 7, p_items: items, p_codigo: 'DIEGO-PROMO1',
  });
});

test('devuelve el contrato oficial y consulta exclusivamente con cafetería y JWT del estudiante', async () => {
  const respuesta = await request(app).get(ruta).set('Authorization', 'Bearer sesion-estudiante');
  expect(respuesta.status).toBe(200);
  expect(respuesta.body).toEqual({ campanas: [campana] });
  expect(getUser).toHaveBeenCalledWith('sesion-estudiante');
  expect(rpc).toHaveBeenCalledWith('listar_oportunidades_campana', { p_cafeteria_id: 7 });
  expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'publishable-test', {
    global: { headers: { Authorization: 'Bearer sesion-estudiante' } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

test('conserva la lista vacía devuelta por la RPC', async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  await request(app).get(ruta).set('Authorization', 'Bearer estudiante').expect(200, { campanas: [] });
});

test.each([undefined, 'Bearer vencido'])('rechaza sesión ausente o inválida (%s)', async encabezado => {
  getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
  const solicitud = request(app).get(ruta);
  if (encabezado) solicitud.set('Authorization', encabezado);
  await solicitud.expect(401);
  expect(rpc).not.toHaveBeenCalled();
});

test.each(['0', '-1', '1.5', 'abc', '9007199254740992'])('rechaza cafetería inválida %s antes de RPC', async id => {
  await request(app).get(ruta.replace('/7/', `/${id}/`)).set('Authorization', 'Bearer estudiante').expect(400);
  expect(rpc).not.toHaveBeenCalled();
});

test('rechaza postulables y parámetros de identidad para no confundir el alcance', async () => {
  for (const consulta of ['postulables=true', 'usuario_id=9', 'cafeteria_id=8']) {
    await request(app).get(`${ruta}?${consulta}`).set('Authorization', 'Bearer estudiante').expect(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test.each([
  ['42501', 403], ['22023', 400], ['PGRST301', 401], ['PGRST303', 401],
  ['28000', 401], ['PGRST202', 503], ['XX000', 503],
])('traduce SQL/PostgREST %s a HTTP %s sin revelar detalles internos', async (code, status) => {
  rpc.mockResolvedValue({ data: null, error: { code, message: 'detalle privado' } });
  const respuesta = await request(app).get(ruta).set('Authorization', 'Bearer estudiante');
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).not.toHaveProperty('campanas');
  expect(JSON.stringify(respuesta.body)).not.toContain('detalle privado');
});

test.each([null, {}, undefined])('no oculta un resultado RPC inválido (%s) como lista vacía', async data => {
  rpc.mockResolvedValue({ data, error: null });
  await request(app).get(ruta).set('Authorization', 'Bearer estudiante').expect(503);
});

test('un fallo de red no devuelve oportunidades ficticias', async () => {
  rpc.mockRejectedValue(new Error('red no disponible'));
  const respuesta = await request(app).get(ruta).set('Authorization', 'Bearer estudiante');
  expect(respuesta.status).toBe(503);
  expect(respuesta.body).not.toHaveProperty('campanas');
});
