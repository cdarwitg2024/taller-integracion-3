const express = require('express');
const router = express.Router();

// Endpoint público para test (sin autenticación)
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Servicio QR funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Middleware de autenticación para el resto de rutas
const authMiddleware = require('../../../middlewares/authMiddleware');
router.use(authMiddleware);

// Endpoint para generar token (protegido)
router.post('/generar', (req, res) => {
  const { pedido_id } = req.body;
  
  if (!pedido_id) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere pedido_id'
    });
  }

  const tokenMock = `mock_${Date.now()}_${pedido_id}`;
  
  res.status(201).json({
    success: true,
    data: {
      token: tokenMock,
      pedido_id: pedido_id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60000).toISOString()
    },
    mensaje: 'Token generado exitosamente (mock)'
  });
});

module.exports = router;