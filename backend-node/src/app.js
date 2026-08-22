const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Importar rutas principales
const tiemposRoutes = require('./routes/tiempos/tiemposRoutes');
const healthRoutes = require('./routes/healthRoutes');
// ✅ Importar rutas QR
const qrRoutes = require('./services/qr/routes/qrRoutes');

const app = express();

// Middleware global
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/tiempos', tiemposRoutes);
app.use('/api/qr', qrRoutes);  // ✅ NUEVA RUTA QR
app.use('/health', healthRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'Backend Cafetería Universitaria',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      tiempos: '/api/tiempos',
      qr: '/api/qr'  // ✅ Agregar QR a la lista de endpoints
    }
  });
});

// Middleware de error 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.message);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;