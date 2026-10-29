const express = require('express');
const router = express.Router();
const { registrarPago } = require('./pagos.controller');

router.post('/', registrarPago);

module.exports = router;