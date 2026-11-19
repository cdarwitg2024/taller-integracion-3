import { ApiError } from './backendClient';
import { listarCafeteriasAfiliados, listarCampanasActivas } from './campanasAfiliados';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

const ahora = Date.parse('2026-11-17T12:00:00Z');
const campana = (cambios = {}) => ({
  id: 31, nombre: 'Campaña activa', estado: 'activa',
  cafeteria_id: 7, cafeteria_nombre: 'Norte', tipo: 'carrito_completo', estado_vigencia: 'en_curso',
  tasa_descuento: 15, tasa_comision: 10,
  vigencia_desde: '2026-11-01T00:00:00Z', vigencia_hasta: '2026-12-01T00:00:00Z', ...cambios,
});
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
const responder = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
let transporte: jest.Mock;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'sesion-ficticia-a' } }, error: null });
  transporte = jest.fn();
  global.fetch = transporte;
});

afterEach(() => {
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('consulta el catálogo público y la URL estudiantil C02 con la sesión activa', async () => {
  transporte.mockResolvedValueOnce(responder({ data: [{ id: 7, nombre: 'Norte' }] }))
    .mockResolvedValueOnce(responder({ campanas: [campana()] }));
  expect(await listarCafeteriasAfiliados()).toEqual([{ id: 7, nombre: 'Norte' }]);
  expect(await listarCampanasActivas(7)).toHaveLength(1);
  expect(transporte.mock.calls[0][0]).toBe('http://gateway-prueba/api/cafeterias');
  expect(transporte.mock.calls[0][1].headers.Authorization).toBeUndefined();
  expect(transporte.mock.calls[1][0]).toBe('http://gateway-prueba/api/afiliados/cafeterias/7/campanas');
  expect(transporte.mock.calls[1][1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer sesion-ficticia-a' } });
});

test('lee nuevamente el token al cambiar de cuenta y no conserva el anterior', async () => {
  transporte.mockResolvedValue(responder({ campanas: [] }));
  await listarCampanasActivas(7);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'sesion-ficticia-b' } }, error: null });
  await listarCampanasActivas(8);
  expect(transporte.mock.calls.map(([, opciones]) => opciones.headers.Authorization))
    .toEqual(['Bearer sesion-ficticia-a', 'Bearer sesion-ficticia-b']);
});

test('solo publica activas vigentes y excluye pausadas, vencidas, futuras y programadas', async () => {
  transporte.mockResolvedValue(responder({ campanas: [
    campana(), campana({ id: 32, estado: 'pausada' }),
    campana({ id: 33, vigencia_hasta: '2026-11-16T12:00:00Z' }),
    campana({ id: 34, vigencia_desde: '2026-11-18T12:00:00Z' }),
    campana({ id: 35, estado: 'programada' }), campana({ id: 36, estado: 'finalizada' }),
  ] }));
  expect((await listarCampanasActivas(7)).map(c => c.id)).toEqual([31]);
});

test('inicio inclusivo, fin exclusivo y fechas con zona horaria', async () => {
  transporte.mockResolvedValue(responder({ campanas: [
    campana({ id: 31, vigencia_desde: '2026-11-17T09:00:00-03:00' }),
    campana({ id: 32, vigencia_hasta: '2026-11-17T09:00:00-03:00' }),
  ] }));
  expect((await listarCampanasActivas(7)).map(c => c.id)).toEqual([31]);
});

test('un listado vacío es un resultado válido', async () => {
  transporte.mockResolvedValue(responder({ campanas: [] }));
  expect(await listarCampanasActivas(7)).toEqual([]);
});

test('conserva los once campos oficiales de C04 sin los alias de administración', async () => {
  transporte.mockResolvedValue(responder({ campanas: [campana()] }));
  expect((await listarCampanasActivas(7))[0]).toEqual(campana());
});

test('un estado de vigencia distinto de en_curso no se muestra como oportunidad activa', async () => {
  transporte.mockResolvedValue(responder({ campanas: [campana({ estado_vigencia: 'futura' })] }));
  expect(await listarCampanasActivas(7)).toEqual([]);
});

test.each([
  { inesperado: [] }, { campanas: null }, { campanas: [campana({ vigencia_hasta: 'fecha-invalida' })] },
  { campanas: [campana({ cafeteria_id: 8 })] }, { campanas: [campana({ tasa_comision: 101 })] },
  { campanas: [campana({ cafeteria_id: undefined })] }, { campanas: [campana({ cafeteria_nombre: '' })] },
])('una respuesta inválida no se transforma en un vacío exitoso: %j', async body => {
  transporte.mockResolvedValue(responder(body));
  await expect(listarCampanasActivas(7)).rejects.toThrow();
});

test('conserva tasas no especificadas sin convertirlas en cero', async () => {
  transporte.mockResolvedValue(responder({ campanas: [campana({ tasa_descuento: null })] }));
  expect((await listarCampanasActivas(7))[0].tasa_descuento).toBeNull();
});

test.each([401, 403, 501, 503])('propaga HTTP %s sin respaldo administrativo ni acceso directo a tablas', async status => {
  transporte.mockResolvedValue(responder({ error: 'error_controlado' }, status));
  await expect(listarCampanasActivas(7)).rejects.toMatchObject({ status });
  expect(transporte).toHaveBeenCalledTimes(1);
});

test('sin sesión no envía la solicitud de campañas', async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  await expect(listarCampanasActivas(7)).rejects.toBeInstanceOf(ApiError);
  expect(transporte).not.toHaveBeenCalled();
});

test('una cafetería inválida no produce una URL ni una consulta', async () => {
  await expect(listarCampanasActivas(0)).rejects.toThrow();
  expect(transporte).not.toHaveBeenCalled();
});
