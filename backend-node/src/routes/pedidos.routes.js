const express = require('express');
const router = express.Router();
const { getPedidos } = require('../controllers/pedidos.controller');

router.get('/', getPedidos);

module.exports = router;