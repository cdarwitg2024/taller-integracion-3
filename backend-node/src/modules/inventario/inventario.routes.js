const express = require('express');
const router = express.Router();
const { obtenerMovimientos, obtenerAlertas, verificarAlertaProducto } = require('./inventario.controller');

router.get('/alertas', obtenerAlertas);
router.get('/productos/:producto_id/movimientos', obtenerMovimientos);
router.get('/productos/:producto_id/alertas', verificarAlertaProducto);

module.exports = router;