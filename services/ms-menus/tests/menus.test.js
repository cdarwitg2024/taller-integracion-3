'use strict';

const request = require('supertest');

// El cliente de Supabase se mockea: los tests no tocan la base real.
jest.mock('@coffeefaster/shared', () => {
  const real = jest.requireActual('@coffeefaster/shared');
  return { ...real, obtenerCliente: jest.fn() };
});

const { obtenerCliente, resetCliente } = require('@coffeefaster/shared');
const app = require('../src/app');

/**
 * Cliente falso con la misma cadena que usa supabase-js:
 *   .from(t).select(c)[.is()][.eq()][.in()][.order()][.maybeSingle()]
 * Devuelve `data` al final de la cadena, como el cliente real.
 *
 * `error` a nivel de cliente simula que Supabase esta caido (no que la peticion
 * este mal formada): ahi el service debe terminar en 503.
 */
function clienteFalso({ filas = [], error = null } = {}) {
  const log = { select: [], eq: [], is: [], in: [], order: null, maybeSingle: false };

  // Cadena: cada metodo devuelve el mismo objeto y fija el valor de salida.
  const cadena = {
    from(tabla) {
      log.from = tabla;
      return cadena;
    },
    select(columnas) {
      log.select.push(columnas);
      return cadena;
    },
    is(columna, valor) {
      log.is.push([columna, valor]);
      return cadena;
    },
    eq(columna, valor) {
      log.eq.push([columna, valor]);
      return cadena;
    },
    in(columna, valores) {
      log.in.push([columna, valores]);
      return cadena;
    },
    order(columna, opciones) {
      log.order = [columna, opciones];
      return cadena;
    },
    maybeSingle() {
      log.maybeSingle = true;
      return Promise.resolve(
        filas.length > 0 ? { data: filas[0], error } : { data: null, error }
      );
    },
    then(resolver) {
      return Promise.resolve({ data: filas, error }).then(resolver);
    }
  };

  return { cadena, log };
}

function usarCliente(falso) {
  obtenerCliente.mockReturnValue(falso.cadena);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetCliente();
  usarCliente(clienteFalso({ filas: [] }));
});

describe('GET /api/menus', () => {
  it('lista los productos activos', async () => {
    const filas = [
      { id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true },
      { id: 9, cafeteria_id: 1, nombre: 'Limonada', precio: 3800, activo: true }
    ];
    usarCliente(clienteFalso({ filas }));

    const res = await request(app).get('/api/menus');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.filtro).toBeNull();
  });

  it('filtra por cafeteria_id cuando viene en el query', async () => {
    const falso = clienteFalso({ filas: [] });
    usarCliente(falso);

    await request(app).get('/api/menus?cafeteria_id=1');

    expect(falso.log.eq).toEqual(
      expect.arrayContaining([['cafeteria_id', 1]])
    );
  });

  it('no filtra si cafeteria_id no viene', async () => {
    const falso = clienteFalso({ filas: [] });
    usarCliente(falso);

    await request(app).get('/api/menus');

    const columnasFiltradas = falso.log.eq.filter(([c]) => c === 'cafeteria_id');
    expect(columnasFiltradas).toHaveLength(0);
  });

  it('devuelve 400 si cafeteria_id no es entero', async () => {
    const res = await request(app).get('/api/menus?cafeteria_id=abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cafeteria_id/);
  });

  it('devuelve 503 si Supabase falla', async () => {
    usarCliente(clienteFalso({ filas: [], error: new Error('boom') }));

    const res = await request(app).get('/api/menus');

    expect(res.status).toBe(503);
    expect(res.body.data).toBeUndefined();
  });

  it('filtra los borrados logicamente', async () => {
    const falso = clienteFalso({ filas: [] });
    usarCliente(falso);

    await request(app).get('/api/menus');

    expect(falso.log.is).toEqual(
      expect.arrayContaining([['eliminado_en', null]])
    );
  });
});

describe('GET /api/menus/:id', () => {
  it('devuelve el producto si existe', async () => {
    usarCliente(
      clienteFalso({
        filas: [{ id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true }]
      })
    );

    const res = await request(app).get('/api/menus/7');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(7);
  });

  it('devuelve 404 si no existe', async () => {
    usarCliente(clienteFalso({ filas: [] }));

    const res = await request(app).get('/api/menus/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });

  it('devuelve 400 si el id no es entero', async () => {
    const res = await request(app).get('/api/menus/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entero/i);
  });

  it('devuelve 503 si Supabase falla', async () => {
    usarCliente(clienteFalso({ filas: [], error: new Error('boom') }));

    const res = await request(app).get('/api/menus/7');

    expect(res.status).toBe(503);
  });
});

describe('POST /api/menus/precios', () => {
  const cuerpoValido = { items: [{ producto_id: 7, cantidad: 2 }] };

  it('devuelve el precio LEIDO DE LA BASE, no el que mando el cliente', async () => {
    // El cliente "manda" 1 peso, pero la base dice 3300. Gana la base.
    usarCliente(
      clienteFalso({
        filas: [
          { id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true }
        ]
      })
    );

    const res = await request(app)
      .post('/api/menus/precios')
      .send({
        items: [{ producto_id: 7, cantidad: 2, precio: 1 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.data[0].precio).toBe(3300);
  });

  it('devuelve exactamente los campos del contrato', async () => {
    usarCliente(
      clienteFalso({
        filas: [
          { id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true }
        ]
      })
    );

    const res = await request(app).post('/api/menus/precios').send(cuerpoValido);

    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ['activo', 'cafeteria_id', 'id', 'nombre', 'precio'].sort()
    );
  });

  it('acepta tambien el array pelado', async () => {
    usarCliente(
      clienteFalso({
        filas: [
          { id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true }
        ]
      })
    );

    const res = await request(app)
      .post('/api/menus/precios')
      .send([{ producto_id: 7, cantidad: 1 }]);

    expect(res.status).toBe(200);
  });

  it('respeta el orden de la peticion', async () => {
    usarCliente(
      clienteFalso({
        filas: [
          { id: 9, cafeteria_id: 1, nombre: 'B', precio: 100, activo: true },
          { id: 7, cafeteria_id: 1, nombre: 'A', precio: 200, activo: true }
        ]
      })
    );

    const res = await request(app)
      .post('/api/menus/precios')
      .send({ items: [{ producto_id: 7, cantidad: 1 }, { producto_id: 9, cantidad: 1 }] });

    expect(res.body.data.map((p) => p.id)).toEqual([7, 9]);
  });

  it('devuelve 404 y nombra los ids que no existen', async () => {
    usarCliente(
      clienteFalso({
        filas: [
          { id: 7, cafeteria_id: 1, nombre: 'Capuchino', precio: 3300, activo: true }
        ]
      })
    );

    const res = await request(app)
      .post('/api/menus/precios')
      .send({ items: [{ producto_id: 7, cantidad: 1 }, { producto_id: 4242, cantidad: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.detalle).toMatch(/4242/);
  });

  it('devuelve 400 si el cuerpo no es un array de items', async () => {
    const res = await request(app).post('/api/menus/precios').send({ nope: 1 });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si la lista esta vacia', async () => {
    const res = await request(app).post('/api/menus/precios').send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si cantidad es 0 o negativa', async () => {
    const res = await request(app)
      .post('/api/menus/precios')
      .send({ items: [{ producto_id: 7, cantidad: 0 }] });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si producto_id no es un entero', async () => {
    const res = await request(app)
      .post('/api/menus/precios')
      .send({ items: [{ producto_id: 'siete', cantidad: 1 }] });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si se pasa el tope de items', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ producto_id: i + 1, cantidad: 1 }));

    const res = await request(app).post('/api/menus/precios').send({ items });

    expect(res.status).toBe(400);
  });

  it('devuelve 503 si Supabase falla', async () => {
    usarCliente(clienteFalso({ filas: [], error: new Error('boom') }));

    const res = await request(app).post('/api/menus/precios').send(cuerpoValido);

    expect(res.status).toBe(503);
    expect(res.body.data).toBeUndefined();
  });
});

describe('Aislamiento del recurso', () => {
  it('responde 404 en rutas de otros servicios', async () => {
    const res = await request(app).get('/api/pedidos');

    expect(res.status).toBe(404);
    expect(res.body.recurso).toBe('/api/menus');
  });

  it('GET /health no consulta Supabase', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.servicio).toBe('ms-menus');
    expect(obtenerCliente).not.toHaveBeenCalled();
  });

  it('expone SOLO id, cafeteria_id, nombre, precio y activo', async () => {
    const falso = clienteFalso({ filas: [] });
    usarCliente(falso);

    await request(app).get('/api/menus');

    const columnas = falso.log.select.join(' ');
    // stock es de ms-inventario: si aparece aqui, se duplica la fuente de verdad.
    expect(columnas).not.toMatch(/stock/);
    expect(columnas).toMatch(/nombre/);
    expect(columnas).toMatch(/precio/);
    expect(columnas).toMatch(/activo/);
  });
});