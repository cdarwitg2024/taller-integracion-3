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

/** Construye un cliente Supabase falso con la cadena que el service usa. */
function clienteFalso({ filas = [], error = null } = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: filas[0] || null, error });
  const orden = jest.fn().mockResolvedValue({ data: filas, error });

  const eq = jest.fn(() => ({ order: orden, maybeSingle }));
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