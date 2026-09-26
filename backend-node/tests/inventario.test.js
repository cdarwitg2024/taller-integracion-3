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

async function crearPedidoCon(productoId, cantidad) {
  return request(app)
    .post('/api/pedidos')
    .send({
      cafeteria_id: 2,
      franja_retiro: '10:00 - 10:15',
      productos: [{ producto_id: productoId, cantidad, precio_unitario: 2500 }]
    });
}

describe('Lógica de inventario - relación pedidos y stock', () => {
  beforeEach(() => {
    supabase.__reset();
    supabase.__seed('productos', productosSeed());
  });

  test('Al crear el pedido se descuenta stock y se registra un movimiento de salida', async () => {
    const res = await crearPedidoCon(1, 3);

    expect(res.status).toBe(201);
    expect(stockDe(1)).toBe(7);
    expect(stockDe(2)).toBe(4);

    const salidas = movimientosDe(1);
    expect(salidas).toHaveLength(1);
    expect(salidas[0].tipo).toBe('salida');
    expect(salidas[0].cantidad).toBe(3);
    expect(salidas[0].producto_id).toBe(1);
  });

  test('Rechaza con 409 si la cantidad solicitada supera el stock disponible', async () => {
    const res = await crearPedidoCon(2, 5);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuficiente/i);
    expect(res.body.error).toMatch(/Croissant/);
    expect(stockDe(2)).toBe(4);
    expect(movimientosDe(2)).toHaveLength(0);
  });

  test('Rechaza con 409 si el producto solicitado no existe', async () => {
    const res = await crearPedidoCon(999, 1);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no existe/i);
    expect(stockDe(999)).toBeNull();
  });

  test('Rechaza con 409 si el producto no está activo', async () => {
    const res = await crearPedidoCon(4, 1);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no está disponible/i);
    expect(stockDe(4)).toBe(50);
  });

  test('Al cancelar el pedido se repone el stock y se registra una entrada', async () => {
    const creado = await crearPedidoCon(1, 2);
    expect(creado.status).toBe(201);
    expect(stockDe(1)).toBe(8);

    const cancelado = await request(app)
      .patch(`/api/pedidos/${creado.body.pedido.id}/estado`)
      .send({ estado: 'Cancelado' });

    expect(cancelado.status).toBe(200);
    expect(cancelado.body.pedido.estado).toBe('Cancelado');
    expect(cancelado.body.pedido.cancelado_en).toBeDefined();

    expect(stockDe(1)).toBe(10);

    const movimientos = movimientosDe(1);
    const tipos = movimientos.map(m => m.tipo).sort();
    expect(tipos).toEqual(['entrada', 'salida']);
  });

  test('Un pedido con varias líneas descuenta el stock de cada producto', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .send({
        cafeteria_id: 2,
        franja_retiro: '11:00 - 11:15',
        productos: [
          { producto_id: 1, cantidad: 2, precio_unitario: 2500 },
          { producto_id: 2, cantidad: 1, precio_unitario: 3500 }
        ]
      });

    expect(res.status).toBe(201);
    expect(stockDe(1)).toBe(8);
    expect(stockDe(2)).toBe(3);
    expect(movimientosDe(1)[0].cantidad).toBe(2);
    expect(movimientosDe(2)[0].cantidad).toBe(1);
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
});