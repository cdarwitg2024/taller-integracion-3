'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('@coffeefaster/shared');
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

router.post('/', auth.exigirAuth, crearPedido);
router.get('/', auth.exigirAuth, listarPedidos);
router.get('/:id', auth.exigirAuth, obtenerPedido);
router.get('/cafeteria/:cafeteriaId', auth.exigirAuth, obtenerPedidosPorCafeteria);
router.get('/usuario/:usuarioId', auth.exigirAuth, obtenerPedidosPorUsuario);
router.patch('/:id/estado', auth.exigirAuth, actualizarEstado);
router.get('/:id/qr', auth.exigirAuth, obtenerQr);
router.get('/:id/token-contingencia', auth.exigirAuth, obtenerTokenContingencia);
router.post('/validar-qr', auth.exigirAuth, validarQr);

module.exports = router;
