const express = require('express');
const router = express.Router();
const { obtenerCafeterias, obtenerProductosPorCafeteria } = require('../controllers/cafeterias.controller');

router.get('/', obtenerCafeterias);
router.get('/:cafeteria_id/productos', obtenerProductosPorCafeteria);

module.exports = router;