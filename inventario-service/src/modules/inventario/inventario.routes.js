const express = require('express');
const router = express.Router();
const {
  obtenerMovimientos,
  obtenerAlertas,
  verificarAlertaProducto,
  verificarDisponibilidad,
  crearMovimiento
} = require('./inventario.controller');

router.get('/alertas', obtenerAlertas);
router.get('/productos/:producto_id/movimientos', obtenerMovimientos);
router.get('/productos/:producto_id/alertas', verificarAlertaProducto);

// Endpoints de integración con MS-Pedidos
router.post('/verificar', verificarDisponibilidad);
router.post('/movimientos', crearMovimiento);

module.exports = router;