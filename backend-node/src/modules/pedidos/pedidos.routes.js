const express = require('express');
const router = express.Router();
const {
  crearPedido,
  getPedidos,
  getPedidoById,
  getPedidosByCafeteria,
  getPedidosByUsuario,
  updateEstado,
  obtenerQR,
  obtenerTokenContingencia,
  validarQR
} = require('./pedidos.controller');

// Crear nuevo pedido (App Móvil del Estudiante)
router.post('/', crearPedido);

// Listar pedidos (Panel de Administración)
router.get('/', getPedidos);

// Validar entrega física mediante código QR o Token de contingencia (KDS Cocina)
router.post('/validar-qr', validarQR);

// Generación dinámica del QR asociado a un pedido
router.get('/:id/qr', obtenerQR);

// Token de contingencia alfanumérico de un pedido
router.get('/:id/token-contingencia', obtenerTokenContingencia);

// Obtener comandas por cafetería ordenadas por franja de retiro (KDS Cocina)
router.get('/cafeteria/:cafeteriaId', getPedidosByCafeteria);

// Obtener historial y pedidos activos de un estudiante (App Móvil)
router.get('/usuario/:usuarioId', getPedidosByUsuario);

// Obtener detalle completo de un pedido por ID
router.get('/:id', getPedidoById);

// Actualizar estado del pedido (KDS y Operaciones)
router.patch('/:id/estado', updateEstado);

module.exports = router;