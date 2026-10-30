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

// `createClient` se expone como jest.fn para poder inspeccionar con que
// argumentos (incluido el JWT del estudiante) se construye el cliente.
//
// El cliente autenticado YA NO solo ejecuta RPCs: `crearPedido` y
// `listarPedidos` tambien consultan tablas con `from(...)`. Para no duplicar
// toda la simulacion de Supabase, `from` DELEGA en el mismo cliente falso que
// usa `supabase.obtenerCliente()` (supabaseFalso), asi que hereda exactamente
// sus cadenas `select/eq/in/order/limit/maybeSingle/single/then` y su registro
// de llamadas por tabla. `rpc` sigue siendo el `mockRpc` inspeccionable.
//
// Se lee `supabase.obtenerCliente()` de forma perezosa (dentro de `from`) para
// que cada llamada vea el `mockImplementation` vigente: los tests reconfiguran
// `supa.from` entre casos y el cliente autenticado debe reflejarlo.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (...args) =>
      require('@coffeefaster/shared').supabase.obtenerCliente().from(...args),
    rpc: mockRpc
  }))
}));

const app = require('../src/app');
const { createClient: createClientMock } = require('@supabase/supabase-js');

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
  createClientMock.mockClear();

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

/**
 * Mock stateful del cliente Supabase para las transiciones de estado (D.3).
 * Es "consciente de tabla" porque `actualizarEstado` ahora consulta `pedidos`
 * (lectura + update), `usuarios` (resolucion del usuario interno) y
 * `cafeteria_usuarios` (pertenencia a la cafeteria del pedido).
 *
 * Devuelve el `updateMock`, que permite comprobar si hubo UPDATE y con que
 * cambios. Por defecto simula un EMPLEADO (rol_id=2) que SI pertenece a la
 * cafeteria del pedido.
 */
function configurarPedido(pedidoInicial, opciones = {}) {
  const supa = supabaseMock.obtenerCliente();
  const updateMock = jest.fn();
  let actual = pedidoInicial;

  const usuarioInterno = opciones.usuarioInterno === undefined
    ? { id: 10, rol_id: 2 }
    : opciones.usuarioInterno;
  const pertenece = opciones.pertenece === undefined ? true : opciones.pertenece;

  supa.from.mockImplementation((tabla) => {
    if (tabla === 'usuarios') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: usuarioInterno, error: null })
          })
        })
      };
    }
    if (tabla === 'cafeteria_usuarios') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: pertenece ? { id: 77 } : null, error: null })
            })
          })
        })
      };
    }
    // pedidos
    return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: actual, error: null }) }) }),
      update: (cambios) => {
        updateMock(cambios);
        actual = { ...actual, ...cambios };
        return { eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: actual, error: null }) }) }) };
      }
    };
  });
  return updateMock;
}

/**
 * Mock "consciente de tabla" para las LECTURAS de D.5-B. Cada tabla recibe su
 * propio resultado `{ data, error }` y expone una cadena fluida
 * (`select/eq/in/order/limit`) que resuelve a ese resultado (o via
 * `maybeSingle`/`single`).
 *
 * `cafeteria_usuarios` se usa de dos formas distintas segun el flujo:
 *  - `obtenerCafeteriasDelUsuario` -> espera `data` = lista de filas.
 *  - `perteneceACafeteria`        -> espera `data` = fila o `null`.
 * Cada caso configura la forma que corresponda.
 *
 * Devuelve los "registros" de llamadas por tabla para poder comprobar
 * proyeccion (`select`), filtros (`eq`/`in`) y limite.
 */
function fijarLecturas({
  usuario = { id: 10, rol_id: 1 },
  pedidos = { data: [], error: null },
  cafeterias = { data: null, error: null }
} = {}) {
  const supa = supabaseMock.obtenerCliente();

  const nuevoRegistro = () => ({ select: null, eq: [], in: [], limit: null });
  const registros = {
    usuarios: nuevoRegistro(),
    pedidos: nuevoRegistro(),
    cafeteria_usuarios: nuevoRegistro()
  };

  const cadena = (resultado, registro) => {
    const q = {
      select: (campos) => { registro.select = campos; return q; },
      eq: (col, val) => { registro.eq.push([col, val]); return q; },
      in: (col, val) => { registro.in.push([col, val]); return q; },
      order: () => q,
      limit: (n) => { registro.limit = n; return q; },
      maybeSingle: () => Promise.resolve(resultado),
      single: () => Promise.resolve(resultado),
      then: (resolve) => resolve(resultado)
    };
    return q;
  };

  supa.from.mockReset();
  supa.from.mockImplementation((tabla) => {
    if (tabla === 'usuarios') return cadena({ data: usuario, error: null }, registros.usuarios);
    if (tabla === 'cafeteria_usuarios') return cadena(cafeterias, registros.cafeteria_usuarios);
    if (tabla === 'pedidos') return cadena(pedidos, registros.pedidos);
    return cadena({ data: null, error: null }, nuevoRegistro());
  });

  return registros;
}

// Campos de una proyeccion PostgREST separados por coma, ya normalizados.
const camposDe = (proyeccion) => String(proyeccion).split(',').map((c) => c.trim());

describe('ms-pedidos', () => {
  test('GET /health sin auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('POST /api/pedidos crea con precios de ms-menus', async () => {
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(201);

    // El cliente autenticado (el que consulta `usuarios` y ejecuta
    // `procesar_pago` con el JWT del usuario) se construye con la URL, la
    // publishable key y el Bearer; NUNCA con la service key.
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, opciones] = createClientMock.mock.calls[0];
    expect(url).toBe(process.env.SUPABASE_URL);
    expect(key).toBe('sb_publishable_test');
    expect(key).not.toBe(process.env.SUPABASE_SERVICE_KEY);
    expect(opciones.global.headers.Authorization).toBe('Bearer token123');
    expect(opciones.auth.autoRefreshToken).toBe(false);
    expect(opciones.auth.persistSession).toBe(false);
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

  test('POST /api/pedidos construye el cliente autenticado con el fallback SUPABASE_ANON_KEY', async () => {
    // Sin publishable key, el helper debe caer a SUPABASE_ANON_KEY (que el
    // beforeEach deja definida). Se comprueba integrado en el unico test que
    // ya forzaba este escenario.
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    httpMock.post.mockResolvedValue(respuestaPrecios([producto({ id: 1, cafeteria_id: 1 })]));
    const res = await request(app).post('/api/pedidos').send(bodyPedido());
    expect(res.status).toBe(201);
    expect(createClientMock.mock.calls[0][1]).toBe('sb_anon_test');
  });

  test('POST /api/pedidos 503 sin publishable key ni anon key', async () => {
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
  test.each([
    ['pendiente', 'en_preparacion'],
    ['en_preparacion', 'listo']
  ])('permite %s -> %s y guarda el slug canonico (sin RPC de cancelacion)', async (desde, hacia) => {
    const updateMock = configurarPedido({ id: 5, estado: desde, cafeteria_id: 1 });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: hacia });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe(hacia);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ estado: hacia });
    // Las transiciones normales NO pasan por la RPC de cancelacion.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test.each([
    ['pendiente', 'listo'],
    ['pendiente', 'entregado'],
    ['entregado', 'pendiente'],
    ['cancelado', 'en_preparacion']
  ])('rechaza %s -> %s con 409 y no actualiza', async (desde, hacia) => {
    const updateMock = configurarPedido({ id: 5, estado: desde });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: hacia });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
    // Tampoco se delega a la RPC de cancelacion: el destino no es 'cancelado'.
    expect(mockRpc).not.toHaveBeenCalled();
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

describe('PATCH /api/pedidos/:id/estado — autorizacion KDS (D.3)', () => {
  test.each([
    ['estudiante', { usuarioInterno: { id: 10, rol_id: 1 } }, 403, 'Solo un empleado puede cambiar el estado del pedido'],
    ['dueño', { usuarioInterno: { id: 10, rol_id: 3 } }, 403, 'Solo un empleado puede cambiar el estado del pedido'],
    ['empleado de otra cafeteria', { pertenece: false }, 403, 'El empleado no pertenece a la cafeteria del pedido'],
    ['sin cuenta interna', { usuarioInterno: null }, 404, 'Usuario no encontrado']
  ])('S2-T9: %s no obtiene el pedido por estado identico', async (_actor, opciones, status, error) => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1, qr_token: 'qr-privado-de-prueba' },
      opciones
    );
    const res = await request(app).patch('/api/pedidos/5/estado')
      .send({ estado: 'pendiente', rol_id: 2, cafeteria_id: 1 });
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error, servicio: 'ms-pedidos' });
    expect(updateMock).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test.each(['pendiente', 'en_preparacion', 'listo', 'entregado', 'Preparando'])(
    'S2-T9: empleado autorizado reintenta %s sin efectos ni datos sensibles', async (estado) => {
      const publico = { id: 5, estado, cafeteria_id: 1, total: 5000 };
      const updateMock = configurarPedido({
        ...publico,
        qr_token: 'qr-privado-de-prueba', access_token: 'access-de-prueba',
        refresh_token: 'refresh-de-prueba', Authorization: 'Bearer prueba',
        credenciales: { password: 'prueba' }, session: { user: 'prueba' },
        service_key: 'key-de-prueba', auth: { interno: true }
      });
      for (let intento = 0; intento < 2; intento += 1) {
        const res = await request(app).patch('/api/pedidos/5/estado').send({ estado });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(publico);
      }
      expect(supabaseMock.obtenerCliente().from).toHaveBeenCalledWith('usuarios');
      expect(supabaseMock.obtenerCliente().from).toHaveBeenCalledWith('cafeteria_usuarios');
      expect(updateMock).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    }
  );

  test('empleado autorizado: pendiente -> en_preparacion = 200', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'pendiente', cafeteria_id: 1 });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('en_preparacion');
    expect(updateMock).toHaveBeenCalledWith({ estado: 'en_preparacion' });
  });

  test('empleado autorizado: en_preparacion -> listo = 200', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'en_preparacion', cafeteria_id: 1 });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'listo' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('listo');
    expect(updateMock).toHaveBeenCalledWith({ estado: 'listo' });
  });

  test('estudiante intenta pendiente -> en_preparacion = 403 y NO actualiza', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1 },
      { usuarioInterno: { id: 10, rol_id: 1 } }
    );
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('dueño intenta pendiente -> en_preparacion = 403 y NO actualiza', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1 },
      { usuarioInterno: { id: 10, rol_id: 3 } }
    );
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('empleado de otra cafeteria: pendiente -> en_preparacion = 403 y NO actualiza', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1 },
      { pertenece: false }
    );
    // Aunque el body envie una cafeteria_id "autorizada", la autorizacion usa
    // el cafeteria_id DEL PEDIDO.
    const res = await request(app)
      .patch('/api/pedidos/5/estado')
      .send({ estado: 'en_preparacion', cafeteria_id: 1 });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('empleado autorizado: listo -> entregado = 409 (requiere QR) y NO actualiza', async () => {
    const updateMock = configurarPedido({ id: 5, estado: 'listo', cafeteria_id: 1 });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'entregado' });
    expect(res.status).toBe(409);
    expect(res.body.detalle || res.body.error || '').toMatch(/QR/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('estudiante: listo -> entregado = 403 (autorizacion antes de transicion) y NO actualiza', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'listo', cafeteria_id: 1 },
      { usuarioInterno: { id: 10, rol_id: 1 } }
    );
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'entregado' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'Solo un empleado puede cambiar el estado del pedido', servicio: 'ms-pedidos'
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('pedido inexistente -> 404 (no hay UPDATE)', async () => {
    const supa = supabaseMock.obtenerCliente();
    const updateMock = jest.fn();
    supa.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      update: updateMock
    }));
    const res = await request(app).patch('/api/pedidos/999/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('usuario autenticado sin fila interna -> error coherente y NO actualiza', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1 },
      { usuarioInterno: null }
    );
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'en_preparacion' });
    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('no confia en el rol enviado por el body (estudiante que se declara empleado = 403)', async () => {
    const updateMock = configurarPedido(
      { id: 5, estado: 'pendiente', cafeteria_id: 1 },
      { usuarioInterno: { id: 10, rol_id: 1 } }
    );
    const res = await request(app)
      .patch('/api/pedidos/5/estado')
      .send({ estado: 'en_preparacion', rol_id: 2, rol: 'empleado', usuario_id: 10 });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/pedidos/:id/estado -> cancelado (RPC cancelar_pedido)', () => {
  test('pendiente -> cancelado invoca cancelar_pedido y devuelve monto_reembolsado/saldo_nuevo', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, pedido_id: 5, estado: 'cancelado', monto_reembolsado: 5000, saldo_nuevo: 9000 },
      error: null
    });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      pedido_id: 5,
      estado: 'cancelado',
      monto_reembolsado: 5000,
      saldo_nuevo: 9000
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('cancelar_pedido', { p_pedido_id: 5 });
  });

  test('pasa el p_pedido_id correcto y NO hace UPDATE directo', async () => {
    const supa = supabaseMock.obtenerCliente();
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, pedido_id: 42, estado: 'cancelado', monto_reembolsado: 1000, saldo_nuevo: 1000 },
      error: null
    });
    const res = await request(app).patch('/api/pedidos/42/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('cancelar_pedido', { p_pedido_id: 42 });
    // La cancelacion va por RPC: NO se toca el cliente con service role.
    expect(supa.from).not.toHaveBeenCalled();
  });

  test('usa el JWT del estudiante (Bearer) para construir el cliente de RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, pedido_id: 5, estado: 'cancelado' }, error: null });
    await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const opciones = createClientMock.mock.calls[0][2];
    expect(opciones.global.headers.Authorization).toBe('Bearer token123');
  });

  test('normaliza el alias de ENTRADA Cancelado y delega a la RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, pedido_id: 7, estado: 'cancelado' }, error: null });
    const res = await request(app).patch('/api/pedidos/7/estado').send({ estado: 'Cancelado' });
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('cancelar_pedido', { p_pedido_id: 7 });
  });

  test.each([
    ['no_cancelable', 409],
    ['ya_cancelado', 409],
    ['no_autorizado', 403],
    ['pedido_no_encontrado', 404],
    ['monto_invalido', 422],
    ['monto_no_entero', 422],
    ['saldo_invalido', 422],
    ['sin_wallet', 503]
  ])('motivo %s -> HTTP %i', async (motivo, esperado) => {
    mockRpc.mockResolvedValueOnce({ data: { ok: false, motivo }, error: null });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(esperado);
  });

  test('en_preparacion -> cancelado: delega a la RPC (no UPDATE directo) y responde 409 no_cancelable', async () => {
    const supa = supabaseMock.obtenerCliente();
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, motivo: 'no_cancelable', estado_actual: 'en_preparacion' },
      error: null
    });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(409);
    expect(res.body.detalle).toContain('no_cancelable');
    expect(mockRpc).toHaveBeenCalledWith('cancelar_pedido', { p_pedido_id: 5 });
    expect(supa.from).not.toHaveBeenCalled();
  });

  test('sin_sesion (SQLSTATE 42501) -> 403', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sin_sesion' } });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(403);
  });

  test('error de transporte de la RPC -> 503', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } });
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(503);
  });

  test('estado desconocido no llega a la RPC (400)', async () => {
    const res = await request(app).patch('/api/pedidos/5/estado').send({ estado: 'inventado' });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('id de pedido no numerico -> 400 sin llamar a la RPC', async () => {
    const res = await request(app).patch('/api/pedidos/abc/estado').send({ estado: 'cancelado' });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('GET /api/pedidos — lecturas autorizadas (D.5-B)', () => {
  test('estudiante recibe solo sus pedidos', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: [{ id: 1, usuario_id: 10, estado: 'listo' }], error: null }
    });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // La consulta filtra por el id interno resuelto desde el JWT.
    expect(reg.pedidos.eq).toContainEqual(['usuario_id', 10]);
    expect(reg.pedidos.limit).toBe(100);
  });

  test('empleado recibe solo pedidos de sus cafeterias', async () => {
    const reg = fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      pedidos: { data: [{ id: 2, cafeteria_id: 7, estado: 'pendiente' }], error: null },
      cafeterias: { data: [{ cafeteria_id: 7 }, { cafeteria_id: 8 }], error: null }
    });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(reg.pedidos.in).toContainEqual(['cafeteria_id', [7, 8]]);
  });

  test('empleado sin cafeterias recibe coleccion vacia (200)', async () => {
    fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      cafeterias: { data: [], error: null }
    });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('dueño recibe 403 (sin coleccion global)', async () => {
    fijarLecturas({ usuario: { id: 30, rol_id: 3 } });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(403);
  });

  test('usuario autenticado sin fila interna -> 404', async () => {
    fijarLecturas({ usuario: null });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(404);
  });

  test('la respuesta NO filtra credenciales QR (proyeccion explicita)', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: [{ id: 1, usuario_id: 10, estado: 'listo' }], error: null }
    });
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    const campos = camposDe(reg.pedidos.select);
    expect(campos).not.toContain('qr_token');
    expect(campos).not.toContain('codigo_retiro_diario');
    expect(JSON.stringify(res.body)).not.toMatch(/qr_token|codigo_retiro_diario/);
  });
});

describe('GET /api/pedidos/:id — lectura individual autorizada (D.5-B)', () => {
  test('estudiante obtiene su propio pedido', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 10, cafeteria_id: 1, estado: 'listo' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
    expect(reg.pedidos.eq).toContainEqual(['id', 5]);
  });

  test('estudiante pide un pedido ajeno -> 404 (no revela existencia)', async () => {
    fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 99, cafeteria_id: 1, estado: 'listo' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5');
    expect(res.status).toBe(404);
  });

  test('empleado obtiene un pedido de su cafeteria', async () => {
    const reg = fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      pedidos: { data: { id: 5, usuario_id: 99, cafeteria_id: 7, estado: 'listo' }, error: null },
      cafeterias: { data: { id: 77 }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5');
    expect(res.status).toBe(200);
    // La pertenencia se comprueba contra el cafeteria_id DEL PEDIDO.
    expect(reg.cafeteria_usuarios.eq).toContainEqual(['cafeteria_id', 7]);
    expect(reg.cafeteria_usuarios.eq).toContainEqual(['usuario_id', 20]);
  });

  test('empleado pide un pedido de otra cafeteria -> 404', async () => {
    fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      pedidos: { data: { id: 5, usuario_id: 99, cafeteria_id: 7, estado: 'listo' }, error: null },
      cafeterias: { data: null, error: null }
    });
    const res = await request(app).get('/api/pedidos/5');
    expect(res.status).toBe(404);
  });

  test('dueño -> 404 (sin acceso nuevo)', async () => {
    fijarLecturas({ usuario: { id: 30, rol_id: 3 } });
    const res = await request(app).get('/api/pedidos/5');
    expect(res.status).toBe(404);
  });

  test('id invalido -> 400', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 } });
    const res = await request(app).get('/api/pedidos/abc');
    expect(res.status).toBe(400);
  });

  test('la respuesta NO filtra credenciales QR (proyeccion explicita)', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 10, estado: 'listo' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5');
    const campos = camposDe(reg.pedidos.select);
    expect(campos).not.toContain('qr_token');
    expect(campos).not.toContain('codigo_retiro_diario');
    expect(JSON.stringify(res.body)).not.toMatch(/qr_token|codigo_retiro_diario/);
  });
});

describe('GET /api/pedidos/usuario/:usuarioId (D.5-B)', () => {
  test('estudiante consulta su propio historial', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: [{ id: 1, usuario_id: 10 }], error: null }
    });
    const res = await request(app).get('/api/pedidos/usuario/10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // La query usa el id interno del JWT, no el parametro.
    expect(reg.pedidos.eq).toContainEqual(['usuario_id', 10]);
  });

  test('estudiante consulta otro usuario -> 403', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 } });
    const res = await request(app).get('/api/pedidos/usuario/99');
    expect(res.status).toBe(403);
  });

  test('empleado -> 403', async () => {
    fijarLecturas({ usuario: { id: 20, rol_id: 2 } });
    const res = await request(app).get('/api/pedidos/usuario/20');
    expect(res.status).toBe(403);
  });

  test('dueño -> 403', async () => {
    fijarLecturas({ usuario: { id: 30, rol_id: 3 } });
    const res = await request(app).get('/api/pedidos/usuario/30');
    expect(res.status).toBe(403);
  });

  test('usuarioId invalido -> 400', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 } });
    const res = await request(app).get('/api/pedidos/usuario/abc');
    expect(res.status).toBe(400);
  });

  test('NO devuelve credenciales QR', async () => {
    const reg = fijarLecturas({ usuario: { id: 10, rol_id: 1 }, pedidos: { data: [], error: null } });
    const res = await request(app).get('/api/pedidos/usuario/10');
    const campos = camposDe(reg.pedidos.select);
    expect(campos).not.toContain('qr_token');
    expect(campos).not.toContain('codigo_retiro_diario');
    expect(JSON.stringify(res.body)).not.toMatch(/qr_token|codigo_retiro_diario/);
  });
});

describe('GET /api/pedidos/cafeteria/:cafeteriaId (D.5-B)', () => {
  test('estudiante -> 403', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 } });
    const res = await request(app).get('/api/pedidos/cafeteria/7');
    expect(res.status).toBe(403);
  });

  test('empleado asociado -> 200', async () => {
    const reg = fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      pedidos: { data: [{ id: 1, cafeteria_id: 7 }], error: null },
      cafeterias: { data: { id: 77 }, error: null }
    });
    const res = await request(app).get('/api/pedidos/cafeteria/7');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(reg.cafeteria_usuarios.eq).toContainEqual(['cafeteria_id', 7]);
    expect(reg.pedidos.eq).toContainEqual(['cafeteria_id', 7]);
  });

  test('empleado no asociado -> 403', async () => {
    fijarLecturas({ usuario: { id: 20, rol_id: 2 }, cafeterias: { data: null, error: null } });
    const res = await request(app).get('/api/pedidos/cafeteria/7');
    expect(res.status).toBe(403);
  });

  test('dueño -> 403', async () => {
    fijarLecturas({ usuario: { id: 30, rol_id: 3 } });
    const res = await request(app).get('/api/pedidos/cafeteria/7');
    expect(res.status).toBe(403);
  });

  test('cafeteriaId invalido -> 400', async () => {
    fijarLecturas({ usuario: { id: 20, rol_id: 2 } });
    const res = await request(app).get('/api/pedidos/cafeteria/abc');
    expect(res.status).toBe(400);
  });

  test('NO devuelve credenciales QR', async () => {
    const reg = fijarLecturas({
      usuario: { id: 20, rol_id: 2 },
      pedidos: { data: [], error: null },
      cafeterias: { data: { id: 77 }, error: null }
    });
    const res = await request(app).get('/api/pedidos/cafeteria/7');
    const campos = camposDe(reg.pedidos.select);
    expect(campos).not.toContain('qr_token');
    expect(campos).not.toContain('codigo_retiro_diario');
    expect(JSON.stringify(res.body)).not.toMatch(/qr_token|codigo_retiro_diario/);
  });
});

describe('GET /api/pedidos/:id/qr — credencial de retiro (D.5-B)', () => {
  test.each(['pendiente', 'en_preparacion', 'listo'])(
    'estudiante propietario en estado %s -> 200 con qr_token',
    async (estado) => {
      fijarLecturas({
        usuario: { id: 10, rol_id: 1 },
        pedidos: { data: { id: 5, usuario_id: 10, estado, qr_token: 'tok-5' }, error: null }
      });
      const res = await request(app).get('/api/pedidos/5/qr');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ qr_token: 'tok-5' });
    }
  );

  test('estudiante pide el QR de un pedido ajeno -> 404', async () => {
    fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 99, estado: 'listo', qr_token: 'tok-5' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5/qr');
    expect(res.status).toBe(404);
  });

  test('empleado -> 404 (el QR es del estudiante)', async () => {
    fijarLecturas({ usuario: { id: 20, rol_id: 2 } });
    const res = await request(app).get('/api/pedidos/5/qr');
    expect(res.status).toBe(404);
  });

  test('dueño -> 404', async () => {
    fijarLecturas({ usuario: { id: 30, rol_id: 3 } });
    const res = await request(app).get('/api/pedidos/5/qr');
    expect(res.status).toBe(404);
  });

  test.each(['entregado', 'cancelado'])('estado %s -> 409 (QR no disponible)', async (estado) => {
    fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 10, estado, qr_token: 'tok-5' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5/qr');
    expect(res.status).toBe(409);
  });

  test('pedido inexistente -> 404', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 }, pedidos: { data: null, error: null } });
    const res = await request(app).get('/api/pedidos/999/qr');
    expect(res.status).toBe(404);
  });

  test('id invalido -> 400', async () => {
    fijarLecturas({ usuario: { id: 10, rol_id: 1 } });
    const res = await request(app).get('/api/pedidos/abc/qr');
    expect(res.status).toBe(400);
  });

  test('no devuelve codigo_retiro_diario ni imagen; si qr_token', async () => {
    const reg = fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 10, estado: 'listo', qr_token: 'tok-5' }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5/qr');
    expect(res.body).not.toHaveProperty('codigo_retiro_diario');
    expect(res.body).not.toHaveProperty('qr_image');
    // El endpoint dedicado SI proyecta qr_token (y solo ese).
    expect(camposDe(reg.pedidos.select)).toContain('qr_token');
    expect(camposDe(reg.pedidos.select)).not.toContain('codigo_retiro_diario');
  });
});

describe('regresion D.5-B', () => {
  test('token-contingencia sigue respondiendo { token } al propietario', async () => {
    fijarLecturas({
      usuario: { id: 10, rol_id: 1 },
      pedidos: { data: { id: 5, usuario_id: 10, cafeteria_id: 1 }, error: null }
    });
    const res = await request(app).get('/api/pedidos/5/token-contingencia');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).not.toHaveProperty('codigo_retiro_diario');
  });
});
