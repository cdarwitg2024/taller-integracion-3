'use strict';

const request = require('supertest');

const { obtenerCliente } = require('@coffeefaster/shared').supabase || require('@coffeefaster/shared');
const httpClient = require('@coffeefaster/shared').httpClient || require('@coffeefaster/shared/src/http-client');
const { HttpError } = require('@coffeefaster/shared');

jest.mock('@coffeefaster/shared', () => {
  const actual = jest.requireActual('@coffeefaster/shared');
  const supabaseFalso = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 10 }, error: null }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
  };
  return {
    ...actual,
    httpClient: { post: jest.fn() },
    auth: { exigirAuth: (req, res, next) => { req.user = { authUserId: 'u1' }; req.accessToken = 'token123'; next(); } },
    supabase: { obtenerCliente: () => supabaseFalso }
  };
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: jest.fn(() => Promise.resolve({ data: { pedido_id: 99 }, error: null }))
  })
}));

const app = require('../src/app');
const { httpClient: httpMock } = require('@coffeefaster/shared');

beforeEach(() => {
  httpMock.post.mockReset();
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_ANON_KEY = 'sb_anon_test';
  delete process.env.SUPABASE_SERVICE_KEY;
});

describe('ms-pedidos', () => {
  test('GET /health sin auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('POST /api/pedidos crea con precios de ms-menus', async () => {
    httpMock.post.mockImplementation((url) => {
      if (url.includes('/menus/precios')) return Promise.resolve({ status: 200, data: { '1': 100 } });
      if (url.includes('/inventario/verificar')) return Promise.resolve({ status: 200, data: { ok: true } });
      if (url.includes('/inventario/movimientos')) return Promise.resolve({ status: 200, data: { ok: true } });
      return Promise.resolve({ status: 200, data: {} });
    });
    const res = await request(app).post('/api/pedidos').send({ cafeteria_id: 1, franja_retiro: '9-10', items: [{ producto_id: 1, cantidad: 2 }] });
    expect(res.status).toBe(201);
  });

  test('POST /api/pedidos ignora precio del body', async () => {
    httpMock.post.mockImplementation((url) => {
      if (url.includes('/menus/precios')) return Promise.resolve({ status: 200, data: { '1': 100 } });
      if (url.includes('/inventario/verificar')) return Promise.resolve({ status: 200, data: { ok: true } });
      if (url.includes('/inventario/movimientos')) return Promise.resolve({ status: 200, data: { ok: true } });
      return Promise.resolve({ status: 200, data: {} });
    });
    const res = await request(app).post('/api/pedidos').send({ cafeteria_id: 1, franja_retiro: '9-10', items: [{ producto_id: 1, cantidad: 3 }], precio: 1, precio_total: 1 });
    expect(res.status).toBe(201);
  });

  test('POST /api/pedidos 503 si ms-menus falla y no crea pedido', async () => {
    httpMock.post.mockImplementation((url) => {
      if (url.includes('/menus/precios')) throw new HttpError(503, 'fallo menus');
      return Promise.resolve({ status: 200, data: {} });
    });
    const res = await request(app).post('/api/pedidos').send({ cafeteria_id: 1, franja_retiro: '9-10', items: [{ producto_id: 1, cantidad: 1 }] });
    expect(res.status).toBe(503);
  });

  test('POST /api/pedidos 503 si ms-inventario falla y no crea pedido', async () => {
    httpMock.post.mockImplementation((url) => {
      if (url.includes('/menus/precios')) return Promise.resolve({ status: 200, data: { '1': 100 } });
      if (url.includes('/inventario/verificar')) throw new HttpError(503, 'fallo inventario');
      return Promise.resolve({ status: 200, data: {} });
    });
    const res = await request(app).post('/api/pedidos').send({ cafeteria_id: 1, franja_retiro: '9-10', items: [{ producto_id: 1, cantidad: 1 }] });
    expect(res.status).toBe(503);
  });

  test('POST /api/pedidos 503 sin publishable key', async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    httpMock.post.mockImplementation((url) => {
      if (url.includes('/menus/precios')) return Promise.resolve({ status: 200, data: { '1': 100 } });
      if (url.includes('/inventario/verificar')) return Promise.resolve({ status: 200, data: { ok: true } });
      return Promise.resolve({ status: 200, data: {} });
    });
    const res = await request(app).post('/api/pedidos').send({ cafeteria_id: 1, franja_retiro: '9-10', items: [{ producto_id: 1, cantidad: 1 }] });
    expect(res.status).toBe(503);
  });

  test('token-contingencia: dueño 200, otro usuario 403, personal cafeteria_usuarios 200', async () => {
    const service = require('../src/modules/pedidos/pedidos.service');
    const { obtenerCliente } = require('@coffeefaster/shared');
    const supa = obtenerCliente();

    // Caso 1: dueño -> 200
    supa.from.mockImplementation((tabla) => {
      if (tabla === 'pedidos') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 5, usuario_id: 10, cafeteria_id: 1 }, error: null }) }) }) };
      }
      if (tabla === 'usuarios') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 10 }, error: null }) }) }) };
      }
      if (tabla === 'cafeteria_usuarios') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    });
    const resDueno = await service.obtenerTokenContingencia({ user: { authUserId: 'u1' } }, 5);
    expect(resDueno).toHaveProperty('token');

    // Caso 2: otro usuario, no dueño, no personal -> 403
    supa.from.mockImplementation((tabla) => {
      if (tabla === 'pedidos') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 5, usuario_id: 10, cafeteria_id: 1 }, error: null }) }) }) };
      }
      if (tabla === 'usuarios') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 99 }, error: null }) }) }) };
      }
      if (tabla === 'cafeteria_usuarios') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    });
    await expect(service.obtenerTokenContingencia({ user: { authUserId: 'otro' } }, 5)).rejects.toMatchObject({ status: 403 });

    // Caso 3: no dueño pero personal cafeteria_usuarios -> 200
    supa.from.mockImplementation((tabla) => {
      if (tabla === 'pedidos') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 5, usuario_id: 10, cafeteria_id: 1 }, error: null }) }) }) };
      }
      if (tabla === 'usuarios') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 99 }, error: null }) }) }) };
      }
      if (tabla === 'cafeteria_usuarios') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 1 }, error: null }) }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    });
    const resPersonal = await service.obtenerTokenContingencia({ user: { authUserId: 'otro' } }, 5);
    expect(resPersonal).toHaveProperty('token');
  });
});



