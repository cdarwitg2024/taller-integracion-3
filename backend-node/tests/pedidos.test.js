const request = require('supertest');
const app = require('../src/app');

describe('Pruebas del Módulo de Pedidos (SRS CoffeeFast)', () => {
  let pedidoCreado = null;

  describe('POST /api/pedidos - Creación de Pedido', () => {
    test('Debe rechazar la creación si falta cafeteria_id', async () => {
      const res = await request(app)
        .post('/api/pedidos')
        .send({
          franja_retiro: '10:00 - 10:15',
          productos: [{ producto_id: '1', cantidad: 1, precio_unitario: 1500 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cafeteria_id/i);
    });

    test('Debe rechazar la creación si falta franja_retiro', async () => {
      const res = await request(app)
        .post('/api/pedidos')
        .send({
          cafeteria_id: 'cafe-central-01',
          productos: [{ producto_id: '1', cantidad: 1, precio_unitario: 1500 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/franja_retiro/i);
    });

    test('Debe rechazar la creación si la lista de productos está vacía', async () => {
      const res = await request(app)
        .post('/api/pedidos')
        .send({
          cafeteria_id: 'cafe-central-01',
          franja_retiro: '10:00 - 10:15',
          productos: []
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/al menos un producto/i);
    });

    test('Debe crear un pedido exitosamente con todos los requerimientos del SRS', async () => {
      const payload = {
        usuario_id: 'usr-estudiante-test-01',
        cafeteria_id: 'cafe-central-01',
        franja_retiro: '10:15 - 10:25',
        productos: [
          {
            producto_id: 'prod-cafe-americano',
            nombre: 'Café Americano',
            cantidad: 2,
            precio_unitario: 1800,
            notas: 'Sin azúcar'
          },
          {
            producto_id: 'prod-croissant',
            nombre: 'Croissant de Jamón',
            cantidad: 1,
            precio_unitario: 2200,
            notas: 'Calentado'
          }
        ]
      };

      const res = await request(app)
        .post('/api/pedidos')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.mensaje).toBe('Pedido creado exitosamente');
      
      const pedido = res.body.pedido;
      pedidoCreado = pedido;

      // Validar campos requeridos por el SRS
      expect(pedido).toHaveProperty('id');
      expect(pedido).toHaveProperty('codigo_legible');
      expect(pedido.codigo_legible).toMatch(/^#CF-/);
      expect(pedido.cafeteria_id).toBe('cafe-central-01');
      expect(pedido.usuario_id).toBe('usr-estudiante-test-01');
      expect(pedido.franja_retiro).toBe('10:15 - 10:25');
      expect(pedido.estado).toBe('Pagado'); // Estado inicial según BR-06
      
      // Total calculado en backend: (2 * 1800) + (1 * 2200) = 5800
      expect(pedido.total).toBe(5800);

      // Identificadores de retiro requeridos por el SRS
      expect(pedido).toHaveProperty('qr_token');
      expect(pedido.qr_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(pedido).toHaveProperty('qr_image');
      expect(pedido.qr_image).toMatch(/^data:image\/png;base64,/);
      expect(pedido).toHaveProperty('token_contingencia');
      expect(pedido.token_contingencia).toMatch(/^CF-[A-Z0-9]{6}$/);

      // Desglose de productos
      expect(pedido.productos).toHaveLength(2);
      expect(pedido.productos[0].subtotal).toBe(3600);
      expect(pedido.productos[1].subtotal).toBe(2200);
    });
  });

  describe('Consultas y Visibilidad (Estudiante, KDS, Dueño)', () => {
    test('GET /api/pedidos - Visible para Administración', async () => {
      const res = await request(app).get('/api/pedidos');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/pedidos/cafeteria/:cafeteriaId - Visible para KDS (Comandas ordenadas)', async () => {
      const res = await request(app).get('/api/pedidos/cafeteria/cafe-central-01');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const comanda = res.body.find(p => p.id === pedidoCreado.id);
      expect(comanda).toBeDefined();
    });

    test('GET /api/pedidos/usuario/:usuarioId - Visible para App Móvil (Estudiante)', async () => {
      const res = await request(app).get('/api/pedidos/usuario/usr-estudiante-test-01');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(p => p.id === pedidoCreado.id)).toBe(true);
    });

    test('GET /api/pedidos/:id - Detalle completo', async () => {
      const res = await request(app).get(`/api/pedidos/${pedidoCreado.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(pedidoCreado.id);
      expect(res.body.total).toBe(5800);
    });
  });

  describe('Ciclo de Vida y Validación de Retiro', () => {
    test('PATCH /api/pedidos/:id/estado - Transición a "En preparación"', async () => {
      const res = await request(app)
        .patch(`/api/pedidos/${pedidoCreado.id}/estado`)
        .send({ estado: 'En preparación' });

      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('En preparación');
      expect(res.body.pedido).toHaveProperty('inicio_preparacion_en');
    });

    test('PATCH /api/pedidos/:id/estado - Transición a "Listo"', async () => {
      const res = await request(app)
        .patch(`/api/pedidos/${pedidoCreado.id}/estado`)
        .send({ estado: 'Listo' });

      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('Listo');
    });

    test('POST /api/pedidos/validar-qr - Escaneo de QR exitoso en mostrador', async () => {
      const res = await request(app)
        .post('/api/pedidos/validar-qr')
        .send({ token: pedidoCreado.qr_token });

      expect(res.status).toBe(200);
      expect(res.body.valido).toBe(true);
      expect(res.body.pedido.estado).toBe('Retirado');
      expect(res.body.pedido).toHaveProperty('completado_en');
    });

    test('POST /api/pedidos/validar-qr - Rechazo de token ya usado (Un solo uso)', async () => {
      const res = await request(app)
        .post('/api/pedidos/validar-qr')
        .send({ token: pedidoCreado.qr_token });

      expect(res.status).toBe(400);
      expect(res.body.valido).toBe(false);
      expect(res.body.razon).toMatch(/ya fue entregado/i);
    });

    test('POST /api/pedidos/validar-qr - Soporte de validación con Token de contingencia', async () => {
      // Crear otro pedido para probar el token de contingencia
      const nuevo = await request(app)
        .post('/api/pedidos')
        .send({
          cafeteria_id: 'cafe-central-02',
          franja_retiro: '11:00 - 11:15',
          productos: [{ producto_id: '2', cantidad: 1, precio_unitario: 1000 }]
        });

      const tokenContingencia = nuevo.body.pedido.token_contingencia;
      expect(tokenContingencia).toBeDefined();

      const resValidar = await request(app)
        .post('/api/pedidos/validar-qr')
        .send({ token: tokenContingencia });

      expect(resValidar.status).toBe(200);
      expect(resValidar.body.valido).toBe(true);
      expect(resValidar.body.pedido.estado).toBe('Retirado');
    });
  });
});
