'use strict';

/**
 * Pruebas HTTP del módulo de afiliados.
 *
 * Sustituyen la RPC de Supabase para comprobar los códigos de estado, la
 * validación del cuerpo, el uso del JWT del dueño y la traducción de los
 * rechazos de la base de datos.
 */

const request = require('supertest');
const app = require('../src/app');
const crearCliente = require('../src/cliente-autenticado');

jest.mock('../src/cliente-autenticado', () => jest.fn());
jest.mock('@coffeefaster/shared', () => {
  const shared = jest.requireActual('@coffeefaster/shared');
  return {
    ...shared,
    auth: {
      exigirAuth(req, res, next) {
        req.accessToken = req.get('Authorization')?.replace(/^Bearer /, '');
        if (!req.accessToken) return res.sendStatus(401);
        return next();
      },
    },
  };
});

const ruta = '/api/afiliados/cafeterias/7/campanas';
const alta = {
  nombre: 'Semana del café',
  descuento_normal_pct: 15,
  descuento_oferta_pct: 5,
  comision_pct: 10,
  inicio: '2099-12-01T08:00:00-03:00',
  fin: '2099-12-15T20:00:00-03:00',
};
const rpc = jest.fn();

beforeEach(() => {
  rpc.mockReset();
  crearCliente.mockReset().mockReturnValue({ rpc });
});

test.each([
  ['post', ruta, alta, null, 201, { id: 31, cafeteria_id: 7, estado: 'programada' }],
  ['patch', ruta + '/31', { descuento_normal_pct: 12 }, 31, 200, { id: 31, descuento_normal_pct: 12 }],
  ['patch', ruta + '/31', { pausada: true }, 31, 200, { id: 31, estado: 'pausada' }],
  ['patch', ruta + '/31', { pausada: false }, 31, 200, { id: 31, estado: 'activa' }],
])('%s %s usa la sesión del dueño y devuelve el resultado persistido', async (metodo, url, cambios, id, status, body) => {
  rpc.mockResolvedValue({ data: body });
  const respuesta = await request(app)[metodo](url).set('Authorization', 'Bearer sesion-dueno').send(cambios);
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toEqual(body);
  expect(crearCliente).toHaveBeenCalledWith('sesion-dueno');
  expect(rpc).toHaveBeenCalledWith('administrar_campana_afiliados', {
    p_cafeteria_id: 7,
    p_campana_id: id,
    p_cambios: cambios,
  });
});

test.each([
  [{ descuento_normal_pct: 12 }, 'sin_acceso_cafeteria', 403],
  [{ pausada: false }, 'sin_acceso_cafeteria', 403],
  [{ descuento_normal_pct: 12 }, 'porcentajes_fijados', 409],
  [{ pausada: false }, 'campana_finalizada', 409],
])('PATCH %j traduce el rechazo %s de la base', async (cambios, error, status) => {
  rpc.mockResolvedValue({ error: { message: error } });
  const respuesta = await request(app).patch(ruta + '/31').set('Authorization', 'Bearer sesion').send(cambios);
  expect(respuesta.status).toBe(status);
  expect(respuesta.body).toEqual({ error });
});

test('POST traduce el rechazo del dueño ajeno de la cafetería', async () => {
  rpc.mockResolvedValue({ error: { message: 'sin_acceso_cafeteria' } });
  const respuesta = await request(app).post(ruta).set('Authorization', 'Bearer sesion-ajena').send(alta);
  expect(respuesta.status).toBe(403);
  expect(respuesta.body).toEqual({ error: 'sin_acceso_cafeteria' });
});

test('exige sesión y rechaza la reasignación de cafetería antes de invocar SQL', async () => {
  await request(app).post(ruta).send(alta).expect(401);
  await request(app).patch(ruta + '/31').set('Authorization', 'Bearer sesion')
    .send({ cafeteria_id: 8 }).expect(422, { error: 'campana_invalida' });
  expect(rpc).not.toHaveBeenCalled();
});
