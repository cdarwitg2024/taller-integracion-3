'use strict';

/**
 * Pruebas de ms-cafeterias.
 *
 * Dos casos pedidos explicitamente:
 *   1. GET /api/cafeterias devuelve la lista cuando Supabase responde.
 *   2. GET /api/cafeterias devuelve 503 cuando Supabase falla (sin mocks de
 *      datos: ese es el punto del test).
 *
 * Se mockea el CLIENTE de Supabase, no el service. Asi el service, el controller
 * y el manejo de errores se ejecutan de verdad; solo se corta la red.
 */

jest.mock('@coffeefaster/shared', () => {
  const real = jest.requireActual('@coffeefaster/shared');
  return {
    ...real,
    obtenerCliente: jest.fn()
  };
});

const { obtenerCliente } = require('@coffeefaster/shared');
const request = require('supertest');
const app = require('../src/app');

/**
 * Construye un cliente Supabase falso con la cadena que el service usa.
 *
 * `eq` es encadenable: sirve tanto `.eq('activa', true)` (lista) como
 * `.eq('id', n).eq('activa', true)` (detalle), porque cada llamada devuelve el
 * mismo objeto con `order` y `maybeSingle`.
 */
function clienteFalso({ filas = [], error = null } = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: filas[0] || null, error });
  const orden = jest.fn().mockResolvedValue({ data: filas, error });

  const cadena = { order: orden, maybeSingle };
  cadena.eq = jest.fn(() => cadena);

  const eq = cadena.eq;
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  return { from, select, eq, order: orden, maybeSingle };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /health', () => {
  it('responde healthy sin tocar Supabase', async () => {
    obtenerCliente.mockReturnValue(clienteFalso());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.servicio).toBe('ms-cafeterias');
    // /health no debe consultar la base: si lo hiciera, una caida de Supabase
    // reiniciaria el Pod en bucle.
    expect(obtenerCliente).not.toHaveBeenCalled();
  });
});

describe('GET /api/cafeterias', () => {
  it('devuelve la lista de cafeterias activas', async () => {
    const filas = [
      { id: 1, nombre: 'Cafeteria Central', activa: true },
      { id: 2, nombre: 'Cafe Ingenieria', activa: true }
    ];
    const cliente = clienteFalso({ filas });
    obtenerCliente.mockReturnValue(cliente);

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].nombre).toBe('Cafeteria Central');

    // Verifica que filtra por activa=true: si no, el menu muestra cafeterias
    // cerradas.
    expect(cliente.from).toHaveBeenCalledWith('cafeterias');
    expect(cliente.eq).toHaveBeenCalledWith('activa', true);
    expect(cliente.order).toHaveBeenCalledWith('nombre', { ascending: true });
  });

  it('devuelve lista vacia sin error si no hay cafeterias', async () => {
    obtenerCliente.mockReturnValue(clienteFalso({ filas: [] }));

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('devuelve 503 si Supabase falla, sin datos inventados', async () => {
    obtenerCliente.mockReturnValue(
      clienteFalso({ error: { message: 'conexion rechazada' } })
    );

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(503);
    // Lo importante: NO hay `data` en el cuerpo. Un mock de respuesta seria
    // exactamente el fallo que este diseno evita.
    expect(res.body.data).toBeUndefined();
    expect(res.body.error).toBe('Servicio no disponible');
    expect(res.body.servicio).toBe('ms-cafeterias');
  });

  it('devuelve 503 si Supabase responde con error de red', async () => {
    // Excepcion de socket, no un `error` de PostgREST.
    obtenerCliente.mockImplementation(() => {
      throw new Error('ECONNREFUSED 127.0.0.1:54321');
    });

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Servicio no disponible');
  });

  it('expone solo el recurso cafeterias: /api/menus responde 404', async () => {
    obtenerCliente.mockReturnValue(clienteFalso());

    const res = await request(app).get('/api/menus');

    expect(res.status).toBe(404);
    expect(res.body.recurso).toBe('/api/cafeterias');
  });
});

describe('GET /api/cafeterias/:id', () => {
  it('devuelve la cafeteria si existe', async () => {
    const cliente = clienteFalso({
      filas: [{ id: 1, nombre: 'Cafeteria Central', activa: true }]
    });
    obtenerCliente.mockReturnValue(cliente);

    const res = await request(app).get('/api/cafeterias/1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
    expect(cliente.eq).toHaveBeenCalledWith('id', 1);
  });

  it('devuelve 404 si no existe', async () => {
    obtenerCliente.mockReturnValue(clienteFalso({ filas: [] }));

    const res = await request(app).get('/api/cafeterias/9999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Cafeteria no encontrada');
  });

  it('devuelve 400 si el id no es un entero', async () => {
    obtenerCliente.mockReturnValue(clienteFalso());

    const res = await request(app).get('/api/cafeterias/abc');

    expect(res.status).toBe(400);
    // No debe haber llegado a Supabase.
    expect(obtenerCliente).not.toHaveBeenCalled();
  });

  it('devuelve 503 si Supabase falla al buscar por id', async () => {
    obtenerCliente.mockReturnValue(
      clienteFalso({ error: { message: 'timeout' } })
    );

    const res = await request(app).get('/api/cafeterias/1');

    expect(res.status).toBe(503);
    expect(res.body.data).toBeUndefined();
  });
});

describe('GET /api/cafeterias/:id: solo cafeterias activas', () => {
  it('filtra activa=true al buscar por id', async () => {
    const cliente = clienteFalso({
      filas: [{ id: 1, nombre: 'Cafeteria Central', activa: true }]
    });
    obtenerCliente.mockReturnValue(cliente);

    const res = await request(app).get('/api/cafeterias/1');

    expect(res.status).toBe(200);
    expect(cliente.eq).toHaveBeenCalledWith('id', 1);
    expect(cliente.eq).toHaveBeenCalledWith('activa', true);
  });

  it('una cafeteria inactiva no se devuelve: 404 sin revelar que el id existe', async () => {
    // La consulta filtra activa=true, asi que un id inactivo no lo devuelve la
    // base: el service lo ve como "no existe" y el controller responde 404.
    const cliente = clienteFalso({ filas: [] });
    obtenerCliente.mockReturnValue(cliente);

    const res = await request(app).get('/api/cafeterias/2');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Cafeteria no encontrada');
    expect(cliente.eq).toHaveBeenCalledWith('activa', true);
  });
});

describe('Validacion de :id', () => {
  const invalidos = [
    ['0', 'cero'],
    ['-1', 'negativo'],
    ['abc', 'no numerico'],
    ['1.5', 'decimal'],
    ['9007199254740992', 'mayor que Number.MAX_SAFE_INTEGER'],
    ['99999999999999999999', 'enorme']
  ];

  it.each(invalidos)('rechaza id %s (%s) con 400 sin consultar Supabase', async (valor) => {
    obtenerCliente.mockReturnValue(clienteFalso());

    const res = await request(app).get(`/api/cafeterias/${valor}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El id debe ser un entero positivo');
    // Un id invalido no debe llegar a Supabase: si se convirtiera con perdida de
    // precision, podria consultar un id distinto al solicitado.
    expect(obtenerCliente).not.toHaveBeenCalled();
  });

  it('acepta el limite seguro superior (Number.MAX_SAFE_INTEGER)', async () => {
    const cliente = clienteFalso({ filas: [] });
    obtenerCliente.mockReturnValue(cliente);

    const res = await request(app).get('/api/cafeterias/9007199254740991');

    // No se rechaza por validacion (400); el 404 es porque el mock no devolvio
    // filas, es decir, la consulta si llego a Supabase.
    expect(res.status).toBe(404);
    expect(obtenerCliente).toHaveBeenCalled();
  });
});

describe('Contrato de columnas publicas', () => {
  it('selecciona solo las columnas publicas esperadas', async () => {
    const cliente = clienteFalso();
    obtenerCliente.mockReturnValue(cliente);

    await request(app).get('/api/cafeterias');

    expect(cliente.select).toHaveBeenCalledWith(
      'id, campus_id, nombre, descripcion, hora_apertura, hora_cierre, telefono, imagen_url, activa'
    );
  });
});

describe('Errores 5xx sin filtrar informacion interna', () => {
  it('no expone causa ni el mensaje interno de Supabase', async () => {
    const secreto = 'columna_interna_secreta';
    obtenerCliente.mockReturnValue(
      clienteFalso({ error: { message: secreto, details: 'pista interna' } })
    );

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Servicio no disponible');
    expect(res.body.causa).toBeUndefined();
    expect(res.body.detalle).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(secreto);
  });
});

describe('Configuracion faltante', () => {
  it('devuelve 503 si el cliente no se puede construir', async () => {
    // Es lo que hace obtenerCliente() si falta SUPABASE_URL o la clave.
    obtenerCliente.mockImplementation(() => {
      const err = new Error('Falta SUPABASE_URL en el entorno');
      err.name = 'ConfigError';
      throw err;
    });

    const res = await request(app).get('/api/cafeterias');

    expect(res.status).toBe(503);
    expect(res.body.data).toBeUndefined();
  });
});