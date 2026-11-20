'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { HttpError } = require('@coffeefaster/shared');
const { name, version } = require('../package.json');
const afiliadosRoutes = require('./modules/afiliados/afiliados.routes');
const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => {
  res.status(200).json({
    servicio: name,
    version,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/afiliados', afiliadosRoutes);
app.use((_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

app.use((error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : error.status || 503;
  const mensaje = status >= 500 ? 'Servicio no disponible' : error.message;
  const cuerpo = { error: mensaje, servicio: name };
  if (status < 500 && error.detalle) cuerpo.detalle = error.detalle;
  res.status(status).json(cuerpo);
});

module.exports = app;
