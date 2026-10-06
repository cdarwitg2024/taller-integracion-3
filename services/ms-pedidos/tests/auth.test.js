const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// `exigirAuth` se importa plano: es lo que exporta `@coffeefaster/shared`
// (ver shared/src/index.js). PedidosRoutes lo pide por el mismo camino.
const { exigirAuth } = require('@coffeefaster/shared');
const pedidosRoutes = require('../src/modules/pedidos/pedidos.routes');

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan('dev')); app.use(express.json({ limit: '1mb' }));
app.use('/api/pedidos', pedidosRoutes);
app.use((req, res) => res.status(404).json({}));
app.use((err, req, res, next) => {
  res.status(err.status || 503).json({ error: err.message });
});

describe('ms-pedidos auth', () => {
  test('sin token → 401', async () => {
    const res = await request(app).post('/api/pedidos').send({ items: [{ producto_id: 1, cantidad: 1 }] });
    expect(res.status).toBe(401);
  });
});
