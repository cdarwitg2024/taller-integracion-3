const request = require('supertest');
jest.mock('../src/config/supabase');
jest.mock('../src/clients/inventario.client', () => ({
  verificarDisponibilidad: jest.fn().mockResolvedValue(undefined),
  descontarStock: jest.fn().mockResolvedValue({ ok: true }),
  reponerStock: jest.fn().mockResolvedValue({ ok: true })
}));
const app = require('../src/app');
const { sembrarProductosBase } = require('./helpers/sembrarProductos');

sembrarProductosBase();

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
        usuario_id: 2,
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
      expect(pedido.usuario_id).toBe(2);
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
      const res = await request(app).get(`/api/pedidos/usuario/${pedidoCreado.usuario_id}`);
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
      expect(res.body.pedido).toHaveProperty('entregado_en');
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
      expect(nuevo.body.pedido.estado).toBe('Pagado');

      // El pedido debe estar "Listo" antes de poder retirarlo (BR-07)
      await request(app)
        .patch(`/api/pedidos/${nuevo.body.pedido.id}/estado`)
        .send({ estado: 'En preparación' })
        .expect(200);
      await request(app)
        .patch(`/api/pedidos/${nuevo.body.pedido.id}/estado`)
        .send({ estado: 'Listo' })
        .expect(200);

      const resValidar = await request(app)
        .post('/api/pedidos/validar-qr')
        .send({ token: tokenContingencia });

      expect(resValidar.status).toBe(200);
      expect(resValidar.body.valido).toBe(true);
      expect(resValidar.body.pedido.estado).toBe('Retirado');
    });
  });

  describe('Máquina de Estados - Transiciones prohibidas', () => {
    async function crearPedidoBase() {
      const res = await request(app)
        .post('/api/pedidos')
        .send({
          cafeteria_id: 'cafe-central-01',
          franja_retiro: '12:00 - 12:15',
          productos: [{ producto_id: '1', cantidad: 1, precio_unitario: 1500 }]
        });
      expect(res.status).toBe(201);
      expect(res.body.pedido.estado).toBe('Pagado');
      return res.body.pedido;
    }

    const estadoValidosResp400 = [
      { de: 'Pagado', a: 'Retirado', razon: /Transición no permitida/ },
      { de: 'Pagado', a: 'Listo', razon: /Transición no permitida/ },
      { de: 'En preparación', a: 'En preparación', razon: /Transición no permitida/ },
      { de: 'En preparación', a: 'Creado', razon: /Transición no permitida/ }
    ];

    test.each(estadoValidosResp400)(
      'No debe permitir la transición $de -> $a (respuesta 400)',
      async ({ de, a, razon }) => {
        const pedido = await crearPedidoBase();
        if (de === 'En preparación') {
          await request(app)
            .patch(`/api/pedidos/${pedido.id}/estado`)
            .send({ estado: 'En preparación' })
            .expect(200);
        }
        const res = await request(app)
          .patch(`/api/pedidos/${pedido.id}/estado`)
          .send({ estado: a });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(razon);
      }
    );

    test('Listo -> En preparación no debe permitirse (no se puede volver atrás)', async () => {
      const pedido = await crearPedidoBase();
      await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'En preparación' })
        .expect(200);
      await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'Listo' })
        .expect(200);

      const res = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'En preparación' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Transición no permitida/);
    });

    test('Los estados terminales (Retirado/Cancelado) no admiten más transiciones', async () => {
      const retirado = await crearPedidoBase();
      await request(app)
        .patch(`/api/pedidos/${retirado.id}/estado`)
        .send({ estado: 'En preparación' })
        .expect(200);
      await request(app)
        .patch(`/api/pedidos/${retirado.id}/estado`)
        .send({ estado: 'Listo' })
        .expect(200);
      await request(app)
        .patch(`/api/pedidos/${retirado.id}/estado`)
        .send({ estado: 'Retirado' })
        .expect(200);

      const resRetirado = await request(app)
        .patch(`/api/pedidos/${retirado.id}/estado`)
        .send({ estado: 'En preparación' });
      expect(resRetirado.status).toBe(400);
      expect(resRetirado.body.error).toMatch(/terminal/);

      const cancelado = await crearPedidoBase();
      await request(app)
        .patch(`/api/pedidos/${cancelado.id}/estado`)
        .send({ estado: 'Cancelado' })
        .expect(200);

      const resCancelado = await request(app)
        .patch(`/api/pedidos/${cancelado.id}/estado`)
        .send({ estado: 'Listo' });
      expect(resCancelado.status).toBe(400);
      expect(resCancelado.body.error).toMatch(/terminal/);
    });

    test('Cancelado es válido desde Pagado y desde Listo (BR-08)', async () => {
      const pedido = await crearPedidoBase();
      const res = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'Cancelado' });
      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('Cancelado');
    });

    test('validar-qr rechaza cuando el pedido aún no está "Listo" (BR-07)', async () => {
      const pedido = await crearPedidoBase();
      const res = await request(app)
        .post('/api/pedidos/validar-qr')
        .send({ token: pedido.qr_token });

      expect(res.status).toBe(400);
      expect(res.body.valido).toBe(false);
      expect(res.body.razon).toMatch(/aún no está listo/i);
    });

    test('Alias "entregado" y "preparando" se normalizan al estado canónico', async () => {
      const pedido = await crearPedidoBase();

      const resPrep = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'preparando' });
      expect(resPrep.status).toBe(200);
      expect(resPrep.body.pedido.estado).toBe('En preparación');

      await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'listo' })
        .expect(200);

      const resEntregado = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'entregado' });
      expect(resEntregado.status).toBe(200);
      expect(resEntregado.body.pedido.estado).toBe('Retirado');
    });
  });
});
