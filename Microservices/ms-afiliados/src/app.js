'use strict';

const express = require('express');
const { HttpError } = require('@coffeefaster/shared');
const { name, version } = require('../package.json');
const app = express();

app.disable('x-powered-by');
app.get('/health', (_req, res) => {
  res.status(200).json({
    servicio: name,
    version,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

app.use((error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : 503;
  const mensaje = status >= 500 ? 'Servicio no disponible' : error.message;
  res.status(status).json({ error: mensaje, servicio: name });
});

module.exports = app;
