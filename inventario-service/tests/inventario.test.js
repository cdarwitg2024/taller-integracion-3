const request = require('supertest');
jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const app = require('../src/app');

function productosSeed() {
  return [
    { id: 1, cafeteria_id: 2, nombre: 'Café Americano', precio: 2500, stock: 10, stock_minimo: 3, activo: true },
    { id: 2, cafeteria_id: 2, nombre: 'Croissant de Almendra', precio: 3500, stock: 4, stock_minimo: 2, activo: true },
    { id: 3, cafeteria_id: 3, nombre: 'Galleta de Avena y Pasas', precio: 1800, stock: 1, stock_minimo: 2, activo: true },
    { id: 4, cafeteria_id: 2, nombre: 'Producto Inactivo', precio: 1000, stock: 50, stock_minimo: 1, activo: false }
  ];
}

function stockDe(productoId) {
  const fila = supabase.__tabla('productos').find(p => String(p.id) === String(productoId));
  return fila ? fila.stock : null;
}

function movimientosDe(productoId) {
  return supabase.__tabla('movimientos_inventario').filter(m => String(m.producto_id) === String(productoId));
}

describe('Microservicio Inventario', () => {
  beforeEach(() => {
    supabase.__reset();
    supabase.__seed('productos', productosSeed());
  });

  test('POST /verificar acepta cuando hay stock suficiente', async () => {
    const res = await request(app)
      .post('/api/inventario/verificar')
      .send({ productos: [{ producto_id: 1, cantidad: 3 }] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('POST /verificar responde 409 si la cantidad supera el stock', async () => {
    const res = await request(app)
      .post('/api/inventario/verificar')
      .send({ productos: [{ producto_id: 2, cantidad: 5 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuficiente/i);
    expect(res.body.error).toMatch(/Croissant/);
  });

  test('POST /verificar responde 409 si el producto no existe', async () => {
    const res = await request(app)
      .post('/api/inventario/verificar')
      .send({ productos: [{ producto_id: 999, cantidad: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no existe/i);
  });

  test('POST /verificar responde 409 si el producto está inactivo', async () => {
    const res = await request(app)
      .post('/api/inventario/verificar')
      .send({ productos: [{ producto_id: 4, cantidad: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no está disponible/i);
  });

  test('POST /movimientos tipo salida descuenta stock y registra movimiento', async () => {
    const res = await request(app)
      .post('/api/inventario/movimientos')
      .send({ tipo: 'salida', producto_id: 1, cantidad: 3, usuario_id: 2, motivo: 'Pedido #CF-0001' });

    expect(res.status).toBe(201);
    expect(res.body.stock).toBe(7);
    expect(stockDe(1)).toBe(7);

    const salidas = movimientosDe(1);
    expect(salidas).toHaveLength(1);
    expect(salidas[0].tipo).toBe('salida');
    expect(salidas[0].cantidad).toBe(3);
    expect(salidas[0].producto_id).toBe(1);
    expect(salidas[0].usuario_id).toBe(2);
  });

  test('POST /movimientos tipo entrada repone stock y registra movimiento', async () => {
    const res = await request(app)
      .post('/api/inventario/movimientos')
      .send({ tipo: 'entrada', producto_id: 2, cantidad: 5, motivo: 'reposición' });

    expect(res.status).toBe(201);
    expect(stockDe(2)).toBe(9);

    const entradas = movimientosDe(2);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].tipo).toBe('entrada');
  });

  test('POST /movimientos responde 409 si el descuento deja el stock negativo', async () => {
    const res = await request(app)
      .post('/api/inventario/movimientos')
      .send({ tipo: 'salida', producto_id: 2, cantidad: 99 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuficiente/i);
    expect(stockDe(2)).toBe(4);
    expect(movimientosDe(2)).toHaveLength(0);
  });

  test('POST /movimientos valida tipo y campos obligatorios', async () => {
    const sinTipo = await request(app)
      .post('/api/inventario/movimientos')
      .send({ producto_id: 1, cantidad: 1 });

    expect(sinTipo.status).toBe(400);

    const sinCantidad = await request(app)
      .post('/api/inventario/movimientos')
      .send({ tipo: 'salida', producto_id: 1 });

    expect(sinCantidad.status).toBe(400);
  });

  test('GET /api/inventario/alertas lista productos bajo su stock mínimo', async () => {
    const res = await request(app).get('/api/inventario/alertas');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map(a => a.id);
    expect(ids).toContain(3); // stock 1 <= stock_minimo 2
    expect(ids).not.toContain(1); // stock 10 > stock_minimo 3
    expect(res.body.find(a => a.id === 3).tipo_alerta).toBe('stock_bajo');
  });

  test('GET /api/inventario/productos/:id/alertas verifica un solo producto', async () => {
    const bajo = await request(app).get('/api/inventario/productos/3/alertas');
    expect(bajo.status).toBe(200);
    expect(bajo.body.alertas).toEqual(['stock_bajo']);

    const sano = await request(app).get('/api/inventario/productos/1/alertas');
    expect(sano.status).toBe(200);
    expect(sano.body.alertas).toEqual([]);
  });

  test('GET /api/inventario/productos/:id/movimientos devuelve historial', async () => {
    await request(app)
      .post('/api/inventario/movimientos')
      .send({ tipo: 'salida', producto_id: 1, cantidad: 2 });

    const res = await request(app).get('/api/inventario/productos/1/movimientos');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});