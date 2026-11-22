'use strict';

const request = require('supertest');
const app = require('../src/app');
const { version } = require('../package.json');

test('GET /health identifica al servicio y devuelve un estado saludable', async () => {
  const respuesta = await request(app).get('/health').expect(200);
  expect(respuesta.body).toEqual({
    servicio: 'ms-afiliados',
    version,
    status: 'healthy',
    timestamp: expect.any(String),
  });
});

test('devuelve el error compartido para una ruta inexistente', async () => {
  await request(app).get('/api/afiliados').expect(404, {
    error: 'Ruta no encontrada',
    servicio: 'ms-afiliados',
  });
});
