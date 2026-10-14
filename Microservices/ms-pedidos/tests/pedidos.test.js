'use strict';

const request = require('supertest');

// `shared` queda mockeado (ver mas abajo); se importa ya mockeado para poder
// inspeccionar `httpClient.post` y reconstruir el cliente Supabase falso.
const { supabase: supabaseMock, httpClient: httpMock, HttpError } = require('@coffeefaster/shared');

// `createClient` (cliente con el JWT del usuario) solo se usa para
// `procesar_pago`. Se mockea para comprobar con que argumentos se invoca el RPC.
const mockRpc = jest.fn();

jest.mock('@coffeefaster/shared', () => {
  const actual = jest.requireActual('@coffeefaster/shared');
  const supabaseFalso = {
    from: jest.fn(),
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
  createClient: () => ({ rpc: mockRpc })
}));

const app = require('../src/app');

// Respuesta REAL de ms-menus: httpClient.post -> { status, data: CUERPO_HTTP },
// y el CUERPO_HTTP es { data: [{ id, nombre, precio, activo, cafeteria_id }], total }.
// Antes se mockeaba como mapa producto_id -> precio, que NO es el contrato real.
const respuestaPrecios = (productos) => ({
  status: 200,
  data: { data: productos, total: productos.length }
});

const producto = (overrides = {}) => ({
  id: 1,
  nombre: 'Cafe',
  precio: 100,
  activo: true,
  cafeteria_id: 1,
  ...overrides
});

const bodyPedido = (overrides = {}) => ({
  cafeteria_id: 1,
  franja_retiro: '9-10',
  items: [{ producto_id: 1, cantidad: 1 }],
  ...overrides
});

beforeEach(() => {
  httpMock.post.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { pedido_id: 99 }, error: null });

  // Lookup de `usuarios` en crearPedido. Los tests de token-contingencia
  // reemplazan esta cadena por su propio mock.
  const supa = supabaseMock.obtenerCliente();
  supa.from.mockReset();
  supa.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 10 }, error: null }) }) })
  }));

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
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(201);
  });

  test('POST /api/pedidos permite varios productos de la misma cafeteria', async () => {
    httpMock.post.mockResolvedValue(respuestaPrecios([
      producto({ id: 1, cafeteria_id: 1 }),
      producto({ id: 2, cafeteria_id: 1 })
    ]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido({
      cafeteria_id: 1,
      items: [{ producto_id: 1, cantidad: 1 }, { producto_id: 2, cantidad: 5 }]
    }));
    expect(res.status).toBe(201);
  });

  test('POST /api/pedidos 400 si un producto es de otra cafeteria y no crea pedido', async () => {
    httpMock.post.mockResolvedValue(respuestaPrecios([
      producto({ id: 1, cafeteria_id: 1 }),
      producto({ id: 2, cafeteria_id: 2 })
    ]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido({
      cafeteria_id: 1,
      items: [{ producto_id: 1, cantidad: 1 }, { producto_id: 2, cantidad: 1 }]
    }));
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('POST /api/pedidos ignora el precio del body (procesar_pago es la autoridad)', async () => {
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1, precio: 100 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido({
      items: [{ producto_id: 1, cantidad: 3 }],
      precio: 1,
      precio_total: 1
    }));
    expect(res.status).toBe(201);
    // A `procesar_pago` solo se le pasa cafeteria, items y franja: ningun monto
    // calculado en Node (el precio real lo pone la base de datos).
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('procesar_pago', {
      p_cafeteria_id: 1,
      p_items: [{ producto_id: 1, cantidad: 3 }],
      p_franja_retiro: '9-10'
    });
  });

  test('POST /api/pedidos 503 si ms-menus falla y no crea pedido', async () => {
    httpMock.post.mockRejectedValue(new HttpError(503, 'fallo menus'));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('POST /api/pedidos propaga el 4xx de ms-menus', async () => {
    httpMock.post.mockRejectedValue(new HttpError(400, 'ms-menus rechazo los items'));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('POST /api/pedidos 503 si ms-menus no devuelve productos', async () => {
    httpMock.post.mockResolvedValue({ status: 200, data: { data: [], total: 0 } });
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('POST /api/pedidos no llama a inventario (ya no hay ms-inventario)', async () => {
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(201);
    expect(httpMock.post).toHaveBeenCalledTimes(1);
    expect(httpMock.post.mock.calls[0][0]).toContain('/menus/precios');
  });

  test('POST /api/pedidos 503 sin publishable key', async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test.each([
    ['cero', 0],
    ['negativo', -1],
    ['decimal', 1.5],
    ['string no numerico', 'abc'],
    ['mayor que MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER + 1],
    ['ausente', undefined]
  ])('POST /api/pedidos 400 con cafeteria_id %s (sin llamar a ms-menus ni procesar_pago)', async (_nombre, cafeteria_id) => {
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido({ cafeteria_id }));
    expect(res.status).toBe(400);
    expect(httpMock.post).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('token-contingencia: dueño 200, otro usuario 403, personal cafeteria_usuarios 200', async () => {
    const service = require('../src/modules/pedidos/pedidos.service');
    // `@coffeefaster/shared` mockea `obtenerCliente` en el namespace `.supabase`.
    const { obtenerCliente } = require('@coffeefaster/shared').supabase || require('@coffeefaster/shared');
    const supa = obtenerCliente();

    // dueño
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
    const ok1 = await service.obtenerTokenContingencia({ user: { authUserId: 'u1' } }, 5);
    expect(ok1).toHaveProperty('token');

    // otro usuario 403
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

    // personal
    supa.from.mockImplementation((tabla) => {
      if (tabla === 'pedidos') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 5, usuario_id: 10, cafeteria_id: 1 }, error: null }) }) }) };
      }
      if (tabla === 'usuarios') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 99 }, error: null }) }) }) };
      }
      if (tabla === 'cafeteria_usuarios') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 22 }, error: null }) }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    });
    const resP = await service.obtenerTokenContingencia({ user: { authUserId: 'otro2' } }, 5);
    expect(resP).toHaveProperty('token');
  });
});

describe('pedidos.maquina-estados', () => {
  const maquina = require('../src/modules/pedidos/pedidos.maquina-estados');

  test('estados canonicos definitivos', () => {
    expect(maquina.ESTADOS_CANONICOS).toEqual([
      'pendiente',
      'en_preparacion',
      'listo',
      'entregado',
      'cancelado'
    ]);
  });

  test('el estado inicial es pendiente (pedido ya pagado)', () => {
    expect(maquina.ESTADO_INICIAL).toBe('pendiente');
  });

  test('matriz de transiciones', () => {
    expect(maquina.MATRIZ_TRANSICIONES).toEqual({
      pendiente: ['en_preparacion', 'cancelado'],
      en_preparacion: ['listo'],
      listo: ['entregado'],
      entregado: [],
      cancelado: []
    });
  });

  test('transiciones validas', () => {
    expect(maquina.puedeTransicionar('pendiente', 'en_preparacion')).toBe(true);
    expect(maquina.puedeTransicionar('en_preparacion', 'listo')).toBe(true);
    expect(maquina.puedeTransicionar('listo', 'entregado')).toBe(true);
    expect(maquina.puedeTransicionar('pendiente', 'cancelado')).toBe(true);
  });

  test('transiciones invalidas', () => {
    expect(maquina.puedeTransicionar('pendiente', 'listo')).toBe(false);
    expect(maquina.puedeTransicionar('pendiente', 'entregado')).toBe(false);
    expect(maquina.puedeTransicionar('en_preparacion', 'cancelado')).toBe(false);
    expect(maquina.puedeTransicionar('listo', 'cancelado')).toBe(false);
    expect(maquina.puedeTransicionar('entregado', 'pendiente')).toBe(false);
    expect(maquina.puedeTransicionar('cancelado', 'en_preparacion')).toBe(false);
  });

  test('entregado y cancelado son terminales', () => {
    expect(maquina.esEstadoTerminal('entregado')).toBe(true);
    expect(maquina.esEstadoTerminal('cancelado')).toBe(true);
    expect(maquina.esEstadoTerminal('pendiente')).toBe(false);
    expect(maquina.esEstadoTerminal('listo')).toBe(false);
  });

  test('normalizacion de aliases historicos', () => {
    expect(maquina.normalizarEstado('Pagado')).toBe('pendiente');
    expect(maquina.normalizarEstado('pagado')).toBe('pendiente');
    expect(maquina.normalizarEstado('preparando')).toBe('en_preparacion');
    expect(maquina.normalizarEstado('En preparación')).toBe('en_preparacion');
    expect(maquina.normalizarEstado('en-preparacion')).toBe('en_preparacion');
    expect(maquina.normalizarEstado('Listo')).toBe('listo');
    expect(maquina.normalizarEstado('Retirado')).toBe('entregado');
    expect(maquina.normalizarEstado('retirado')).toBe('entregado');
    expect(maquina.normalizarEstado('Cancelado')).toBe('cancelado');
    expect(maquina.normalizarEstado('inventado')).toBeNull();
  });
});

describe('PATCH /api/pedidos/:id/estado', () => {
  // Mock stateful del cliente Supabase: expone un pedido y permite inspeccionar
  // si hubo UPDATE. `updateMock` recibe el objeto de cambios.
  function configurarPedido(pedidoInicial) {
    const supa = supabaseMock.obtenerCliente();
    const updateMock = jest.fn();
    let actual = pedidoInicial;
    supa.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: actual, error: null }) }) }),
      update: (cambios) => {
        updateMock(cambios);
        actual = { ...actual, ...cambios };
        return { eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: actual, error: null }) }) }) };
      }
    }));
    return updateMock;
  }

  test.each([
    ['pendiente', 'en_preparacion'],
    ['en_preparacion', 'listo'],
    ['listo', 'entregado'],
    ['pendiente', 'cancelado']
  ])('permite %s -> %s y guarda el slug canonico', async (desde, hacia) => {
    const updateMock = configurarPedido({ id: 5, estado: desde });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: hacia });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe(hacia);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ estado: hacia });
  });

  test.each([
    ['pendiente', 'listo'],
    ['pendiente', 'entregado'],
    ['en_preparacion', 'cancelado'],
    ['listo', 'cancelado'],
    ['entregado', 'pendiente'],
    ['cancelado', 'en_preparacion']
  ])('rechaza %s -> %s con 409 y no actualiza', async (desde, hacia) => {
    const updateMock = configurarPedido({ id: 5, estado: desde });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: hacia });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('estado desconocido -> 400 y no actualiza', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'pendiente' });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cualquier_estado_inventado' });
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test.each([
    ['pendiente', 'pendiente'],
    ['listo', 'listo']
  ])('idempotente %s -> %s responde 200 SIN update', async (estado, solicitado) => {
    const updateMock = configurarPedido({ id: 5, estado });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: solicitado });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe(estado);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('pedido inexistente -> 404', async () => {
    const supa = supabaseMock.obtenerCliente();
    supa.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) })
    }));
    const res = await request(app).patch('/api/pedidos/999/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(404);
  });

  test('legacy: Pagado -> en_preparacion permitido y guarda en_preparacion', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'Pagado' });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ estado: 'en_preparacion' });
  });

  test('legacy: preparando -> listo permitido y guarda listo', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'preparando' });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'listo' });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ estado: 'listo' });
  });

  test('legacy: Retirado -> pendiente rechazado 409 (terminal)', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'Retirado' });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'pendiente' });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('alias historico en la ENTRADA se normaliza y persiste canonico', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'pendiente' });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'Preparando' });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ estado: 'en_preparacion' });
  });
});
