const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const inventarioRoutes = require('./modules/inventario/inventario.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    servicio: 'inventario-service',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Microservicio de Inventario - CoffeeFast',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      verificar: 'POST /api/inventario/verificar',
      movimientos: 'POST /api/inventario/movimientos',
      alertas: 'GET /api/inventario/alertas',
      movimientos_producto: 'GET /api/inventario/productos/:id/movimientos',
      alerta_producto: 'GET /api/inventario/productos/:id/alertas'
    }
  });
});

app.use('/api/inventario', inventarioRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});

module.exports = app;