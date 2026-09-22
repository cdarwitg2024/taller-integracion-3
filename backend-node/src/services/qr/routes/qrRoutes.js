const express = require('express');
const router = express.Router();
const QRController = require('../controllers/qrController');
const authMiddleware = require('../../../middlewares/authMiddleware');

router.get('/imagen/:token', QRController.generarImagenQR);

router.use(authMiddleware);

router.post('/generar', QRController.generarToken);
router.get('/validar/:token', QRController.validarToken);
router.post('/usar/:token', QRController.usarToken);
router.get('/info/:token', QRController.obtenerInfo);
router.post('/generar-imagen/:token', QRController.generarQRVisual);
router.post('/limpiar', QRController.limpiarExpirados);

module.exports = router;