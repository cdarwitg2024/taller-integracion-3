const request = require('supertest');
jest.mock('../src/config/supabase');
const app = require('../src/app');

jest.setTimeout(30000);

describe('FR-22 - Generación de QR dinámico', () => {
  let contador = 0;

  async function crearPedido() {
    contador += 1;
    const res = await request(app)
      .post('/api/pedidos')
      .send({
        usuario_id: `usr-fr22-${Date.now()}-${contador}`,
        cafeteria_id: 'cafe-central-01',
        franja_retiro: '12:00 - 12:15',
        productos: [
          { producto_id: '1', nombre: 'Café Americano', cantidad: 1, precio_unitario: 1800 }
        ]
      });
    expect(res.status).toBe(201);
    return res.body.pedido;
  }

  test('Criterio 1: Código diferente por pedido', async () => {
    const pedido1 = await crearPedido();
    const pedido2 = await crearPedido();

    // Tokens distintos para pedidos distintos
    expect(pedido1.qr_token).toBeTruthy();
    expect(pedido2.qr_token).toBeTruthy();
    expect(pedido1.qr_token).not.toBe(pedido2.qr_token);

    // Imágenes QR distintas (codifican tokens diferentes)
    expect(pedido1.qr_image).toBeTruthy();
    expect(pedido1.qr_image).not.toBe(pedido2.qr_image);

    // El endpoint dinámico también devuelve tokens diferentes
    const qr1 = await request(app).get(`/api/pedidos/${pedido1.id}/qr`);
    const qr2 = await request(app).get(`/api/pedidos/${pedido2.id}/qr`);
    expect(qr1.status).toBe(200);
    expect(qr2.status).toBe(200);
    expect(qr1.body.data.qr_token).not.toBe(qr2.body.data.qr_token);

    // El formato corresponde a un token UUID no predecible
    expect(qr1.body.data.qr_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('Criterio 2: Asociación con el pedido correcto', async () => {
    const pedidoA = await crearPedido();
    const pedidoB = await crearPedido();

    const qrA = await request(app).get(`/api/pedidos/${pedidoA.id}/qr`);
    const qrB = await request(app).get(`/api/pedidos/${pedidoB.id}/qr`);

    // El QR de A referencia solo a A, y el de B solo a B
    expect(qrA.body.data.pedido_id).toBe(pedidoA.id);
    expect(qrA.body.data.qr_token).toBe(pedidoA.qr_token);
    expect(qrA.body.data.payload.pedido_id).toBe(pedidoA.id);

    expect(qrB.body.data.pedido_id).toBe(pedidoB.id);
    expect(qrB.body.data.qr_token).toBe(pedidoB.qr_token);

    expect(qrA.body.data.pedido_id).not.toBe(pedidoB.id);

    // Pedido inexistente: 404
    const noExiste = await request(app).get('/api/pedidos/id-inexistente/qr');
    expect(noExiste.status).toBe(404);
  });

  test('Criterio 4: Información suficiente para la validación posterior', async () => {
    const pedido = await crearPedido();
    const res = await request(app).get(`/api/pedidos/${pedido.id}/qr`);

    expect(res.status).toBe(200);
    const payload = res.body.data.payload;

    // Datos mínimos para poder validar la entrega posteriormente.
    // NOTA: franja_retiro no es columna del esquema real y no se persiste;
    // el payload del QR (reconstruido desde BD) lo deja en null.
    expect(payload).toMatchObject({
      pedido_id: pedido.id,
      qr_token: pedido.qr_token,
      cafeteria_id: pedido.cafeteria_id,
      tipo: 'RETIRO_COFFEEFAST'
    });
    expect(payload.created_at).toBeDefined();

    // El qr_token del payload permite ejecutar la validación de entrega
    const validacion = await request(app)
      .post('/api/pedidos/validar-qr')
      .send({ token: payload.qr_token });

    expect(validacion.status).toBe(200);
    expect(validacion.body.valido).toBe(true);
    expect(validacion.body.pedido.id).toBe(pedido.id);
  });

  test('Criterio 3: No reutilización - un token solo puede usarse una vez', async () => {
    const pedido = await crearPedido();
    const qr = await request(app).get(`/api/pedidos/${pedido.id}/qr`);
    const token = qr.body.data.qr_token;

    // Primera validación: exitosa
    const primera = await request(app)
      .post('/api/pedidos/validar-qr')
      .send({ token });
    expect(primera.status).toBe(200);
    expect(primera.body.valido).toBe(true);

    // Reintento con el mismo token: rechazado (single-use)
    const segunda = await request(app)
      .post('/api/pedidos/validar-qr')
      .send({ token });
    expect(segunda.status).toBe(400);
    expect(segunda.body.valido).toBe(false);
    expect(segunda.body.razon).toMatch(/ya fue entregado/i);
  });

  test('Criterio 3: No reutilización - sin QR para pedidos ya entregados', async () => {
    const pedido = await crearPedido();

    await request(app)
      .post('/api/pedidos/validar-qr')
      .send({ token: pedido.qr_token });

    const res = await request(app).get(`/api/pedidos/${pedido.id}/qr`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no puede reutilizarse/i);
  });
});