const express = require('express');
const router = express.Router();
const { obtenerCafeterias, obtenerProductosPorCafeteria } = require('./cafeterias.controller');

router.get('/', obtenerCafeterias);
router.get('/:cafeteria_id/productos', obtenerProductosPorCafeteria);

module.exports = router;