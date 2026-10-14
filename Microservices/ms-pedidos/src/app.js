const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { HttpError } = require('@coffeefaster/shared');
const pedidosRoutes = require('./modules/pedidos/pedidos.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    servicio: 'ms-pedidos',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/pedidos', pedidosRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    servicio: 'ms-pedidos',
    recurso: '/api/pedidos',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : err.status || 503;

  const cuerpo = {
    error: status >= 500 ? 'Servicio no disponible' : err.message,
    servicio: 'ms-pedidos'
  };

  if (status < 500 && err.detalle) cuerpo.detalle = err.detalle;

  if (status >= 500) {
    console.error(`[ms-pedidos] ${status} en ${req.method} ${req.originalUrl}:`, err.message);
    if (err.causa) console.error('  causa:', err.causa);
  }

  res.status(status).json(cuerpo);
});

module.exports = app;
