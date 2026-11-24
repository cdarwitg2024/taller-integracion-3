import { consultarAfiliaciones, solicitarAfiliacion, consultarMovimientosComision, resumirComisiones } from './afiliaciones';
import { supabase } from '../lib/supabase';
jest.mock('../lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), refreshSession: jest.fn() }, from: jest.fn(),
} }));
const pendiente = { id: 82, cafeteria_id: 7, campana_id: 31, estado: 'pendiente' };
const aprobada = { ...pendiente, estado: 'aprobada', codigo: 'CF-SERVIDOR', codigo_activo: true };
const movimiento = (cambios = {}) => ({ id: 1, afiliacion_id: 82, pedido_id: 501,
  tipo: 'comision', estado: 'disponible', monto_clp: 850, creado_en: '2026-11-18T12:00:00Z', ...cambios });
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
let transporte: jest.Mock, query: any;
const responder = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-a06.test';
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'jwt-estudiante-a06' } }, error: null });
  transporte = jest.fn(); global.fetch = transporte;
  query = { select: jest.fn(() => query), eq: jest.fn(() => query), order: jest.fn(() => query),
    range: jest.fn(async () => ({ data: [movimiento()], count: 1, error: null })) };
  (supabase.from as jest.Mock).mockReturnValue(query);
});
afterEach(() => {
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
  jest.clearAllMocks();
});
test('consulta el estado real con el JWT y conserva codigo_activo=false', async () => {
  transporte.mockResolvedValue(responder({ solicitudes: [{ ...aprobada, codigo_activo: false }] }));
  expect(await consultarAfiliaciones()).toEqual([{ ...aprobada, codigo_activo: false }]);
  expect(transporte.mock.calls[0][0]).toBe('http://gateway-a06.test/api/afiliados/mi-perfil');
  expect(transporte.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-estudiante-a06');
});
test.each(['pendiente', 'rechazada'])('estado %s no expone códigos aunque los incluya una respuesta incorrecta', async estado => {
  transporte.mockResolvedValue(responder({ solicitudes: [{ ...aprobada, estado }] }));
  expect(await consultarAfiliaciones()).toEqual([{ ...pendiente, estado }]);
});

test('recorre el cursor de C05 y conserva una aprobación en la segunda página', async () => {
  transporte.mockResolvedValueOnce(responder({ solicitudes: [pendiente], siguiente_antes_de: 82 }))
    .mockResolvedValueOnce(responder({ solicitudes: [{ ...aprobada, id: 81, campana_id: 32 }] }));
  expect(await consultarAfiliaciones()).toEqual([pendiente, { ...aprobada, id: 81, campana_id: 32 }]);
  expect(transporte.mock.calls[1][0]).toBe('http://gateway-a06.test/api/afiliados/mi-perfil?antes_de=82');
  expect(transporte.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt-estudiante-a06');
});

test.each([null, '82', 0, 83])('rechaza un cursor inválido sin publicar un perfil parcial: %j', async cursor => {
  transporte.mockResolvedValue(responder({ solicitudes: [pendiente], siguiente_antes_de: cursor }));
  await expect(consultarAfiliaciones()).rejects.toThrow('continuación');
});

test('un fallo en la segunda página no convierte la primera en un perfil completo', async () => {
  transporte.mockResolvedValueOnce(responder({ solicitudes: [pendiente], siguiente_antes_de: 82 }))
    .mockResolvedValueOnce(responder({ error: 'no_disponible' }, 503));
  await expect(consultarAfiliaciones()).rejects.toMatchObject({ status: 503 });
});

test('rechaza solicitudes repetidas entre páginas', async () => {
  transporte.mockResolvedValueOnce(responder({ solicitudes: [pendiente], siguiente_antes_de: 82 }))
    .mockResolvedValueOnce(responder({ solicitudes: [pendiente] }));
  await expect(consultarAfiliaciones()).rejects.toThrow('duplicadas');
});
test('POST 201 y reintento 200 conservan el ID y solo envían el plan y enlace del estudiante', async () => {
  transporte.mockResolvedValueOnce(responder({ id: 82, estado: 'pendiente' }, 201))
    .mockResolvedValueOnce(responder({ id: 82, estado: 'pendiente' }));
  const primera = await solicitarAfiliacion(7, 31, '  Compartiré un video  ', ' https://example.test/perfil ');
  expect(await solicitarAfiliacion(7, 31, 'Compartiré un video')).toEqual(primera);
  expect(primera).toEqual(pendiente);
  expect(transporte.mock.calls[0][0]).toBe('http://gateway-a06.test/api/afiliados/cafeterias/7/campanas/31/solicitudes');
  expect(JSON.parse(transporte.mock.calls[0][1].body)).toEqual({ plan_promocion: 'Compartiré un video', enlace_publico: 'https://example.test/perfil' });
  expect(transporte.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-estudiante-a06');
  expect(supabase.from).not.toHaveBeenCalled();
});
test.each([
  {}, { solicitudes: null }, { solicitudes: [aprobada, aprobada] },
  { solicitudes: [{ ...aprobada, codigo: undefined }] },
  { solicitudes: [{ ...aprobada, codigo_activo: undefined }] },
])('rechaza respuesta incompleta o duplicada sin inventar aprobación: %j', async body => {
  transporte.mockResolvedValue(responder(body));
  await expect(consultarAfiliaciones()).rejects.toThrow();
});
test('sin plan o con enlace inseguro no envía la solicitud', async () => {
  await expect(solicitarAfiliacion(7, 31, '  ')).rejects.toThrow();
  await expect(solicitarAfiliacion(7, 31, 'Video', 'javascript:alert(1)')).rejects.toThrow();
  expect(transporte).not.toHaveBeenCalled();
});
test('un rechazo HTTP conserva el error y no crea un registro local de aprobación', async () => {
  transporte.mockResolvedValue(responder({ error: 'campana_no_disponible' }, 409));
  await expect(solicitarAfiliacion(7, 31, 'Video')).rejects.toMatchObject({ status: 409 });
  expect(supabase.from).not.toHaveBeenCalled();
});
test('lee movimientos autenticados, por afiliación y con rango acotado', async () => {
  expect(await consultarMovimientosComision(82)).toEqual([movimiento()]);
  expect(supabase.from).toHaveBeenCalledWith('movimientos_comision');
  expect(query.eq).toHaveBeenCalledWith('afiliacion_id', 82);
  expect(query.select).toHaveBeenCalledWith('id,afiliacion_id,pedido_id,tipo,estado,monto_clp,creado_en', { count: 'exact' });
  expect(query.range).toHaveBeenCalledWith(0, 199);
});
test('página completa obliga a leer la siguiente antes de publicar el saldo', async () => {
  query.range.mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => movimiento({ id: i + 1 })), count: 201, error: null })
    .mockResolvedValueOnce({ data: [movimiento({ id: 201 })], count: 201, error: null });
  expect(await consultarMovimientosComision(82)).toHaveLength(201);
  expect(query.range).toHaveBeenLastCalledWith(200, 399);
});

test('recupera tres movimientos aunque PostgREST limite cada respuesta a dos filas', async () => {
  query.range.mockResolvedValueOnce({ data: [movimiento(), movimiento({ id: 2, monto_clp: 200 })], count: 3, error: null })
    .mockResolvedValueOnce({ data: [movimiento({ id: 3, monto_clp: 350 })], count: 3, error: null });
  const filas = await consultarMovimientosComision(82);
  expect(filas.map(f => f.id)).toEqual([1, 2, 3]);
  expect(query.range.mock.calls).toEqual([[0, 199], [2, 201]]);
  expect(resumirComisiones(filas)).toEqual({ disponible: 1400, pendiente: 0 });
});

test.each([
  { data: [movimiento()], count: null, error: null },
  { data: [], count: 3, error: null },
  { data: [movimiento({ id: 3 })], count: 4, error: null },
  { data: null, count: null, error: { code: 'XX000' } },
])('una segunda página incompleta o inconsistente no publica un saldo parcial: %j', async segunda => {
  query.range.mockResolvedValueOnce({ data: [movimiento(), movimiento({ id: 2 })], count: 3, error: null })
    .mockResolvedValueOnce(segunda);
  await expect(consultarMovimientosComision(82)).rejects.toThrow();
});

test('un total exacto cero confirma que no hay movimientos', async () => {
  query.range.mockResolvedValueOnce({ data: [], count: 0, error: null });
  expect(await consultarMovimientosComision(82)).toEqual([]);
});
test.each([
  { data: null, count: 0, error: null }, { data: [], count: 0, error: { code: 'XX000' } },
  { data: [movimiento({ afiliacion_id: 99 })], count: 1, error: null },
  { data: [movimiento(), movimiento()], count: 2, error: null },
])('no presenta como saldo cero un error o filas ajenas: %j', async respuesta => {
  query.range.mockResolvedValue(respuesta);
  await expect(consultarMovimientosComision(82)).rejects.toThrow();
});
test('disponibles y pendientes excluyen la comisión revertida y su compensación', () => {
  expect(resumirComisiones([
    movimiento(), movimiento({ id: 2, estado: 'pendiente', monto_clp: 250 }),
    movimiento({ id: 3, estado: 'revertida', monto_clp: 100 }),
    movimiento({ id: 4, tipo: 'reversion', estado: 'revertida', monto_clp: -100 }),
  ] as any)).toEqual({ disponible: 850, pendiente: 250 });
});
