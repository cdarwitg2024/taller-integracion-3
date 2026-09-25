const express = require('express');
const router = express.Router();
const TiemposController = require('./tiemposController');
const { autenticarToken } = require('../auth/auth.middleware');

// Todas las rutas requieren autenticación JWT
router.use(autenticarToken);

// Rutas públicas (con autenticación)
router.get('/cafeterias', TiemposController.getCafeterias);

// Estimación de tiempos
router.get('/estimacion', TiemposController.getTiemposAll);
router.get('/estimacion/:cafeteriaId', TiemposController.getTiempoEstimado);

// Recomendaciones
router.get('/recomendaciones/:cafeteriaId', TiemposController.getRecomendaciones);

// Cálculo de métricas (POST por si viene con muchos datos)
router.post('/metricas', TiemposController.calcularMetricas);

// Rutas de simulación (solo desarrollo)
if (process.env.NODE_ENV === 'development') {
  router.post('/simular/llegada', TiemposController.simularLlegada);
}

module.exports = router;