const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { HttpError } = require('@coffeefaster/shared');
const cafeteriasRoutes = require('./modules/cafeterias/cafeterias.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    servicio: 'ms-cafeterias',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// UN SOLO RECURSO. Todo lo demas responde 404.
app.use('/api/cafeterias', cafeteriasRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    servicio: 'ms-cafeterias',
    recurso: '/api/cafeterias',
    path: req.originalUrl
  });
});

// Manejador de errores: un solo lugar donde se decide el status.
// `err.status` viene de HttpError del modulo compartido; `503` por defecto
// para todo lo demas, porque si llego aqui sin status es infraestructura.
app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : err.status || 503;

  const cuerpo = {
    error: status >= 500 ? 'Servicio no disponible' : err.message,
    servicio: 'ms-cafeterias'
  };

  // `detalle` es el contexto que el controller adjunto al error (p.ej.
  // "Ids no disponibles: 4242"). HttpError lo guarda en err.detalle. Si el
  // controller no adjunto nada, se omite: repetir err.message solo agrega ruido.
  if (status < 500 && err.detalle) cuerpo.detalle = err.detalle;

  if (status >= 500) {
    console.error(`[ms-cafeterias] ${status} en ${req.method} ${req.originalUrl}:`, err.message);
    if (err.causa) console.error('  causa:', err.causa);
  }

  res.status(status).json(cuerpo);
});

module.exports = app;