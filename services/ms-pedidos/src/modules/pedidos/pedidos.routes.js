'use strict';

const express = require('express');
const router = express.Router();
const { exigirAuth } = require('@coffeefaster/shared').auth || require('@coffeefaster/shared');
const {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  obtenerPedidosPorCafeteria,
  obtenerPedidosPorUsuario,
  actualizarEstado,
  obtenerQr,
  obtenerTokenContingencia,
  validarQr
} = require('./pedidos.controller');

router.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

router.post('/', exigirAuth, crearPedido);
router.get('/', exigirAuth, listarPedidos);
router.get('/:id', exigirAuth, obtenerPedido);
router.get('/cafeteria/:cafeteriaId', exigirAuth, obtenerPedidosPorCafeteria);
router.get('/usuario/:usuarioId', exigirAuth, obtenerPedidosPorUsuario);
router.patch('/:id/estado', exigirAuth, actualizarEstado);
router.get('/:id/qr', exigirAuth, obtenerQr);
router.get('/:id/token-contingencia', exigirAuth, obtenerTokenContingencia);
router.post('/validar-qr', exigirAuth, validarQr);

module.exports = router;
