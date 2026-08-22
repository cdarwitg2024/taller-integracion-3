const QRService = require('../services/qrService');
const QRModel = require('../models/qrModel');

class QRController {
  /**
   * Genera un nuevo token QR
   * POST /api/qr/generar
   */
  static async generarToken(req, res) {
    try {
      const datosPedido = req.body;

      // Validar datos mínimos
      if (!datosPedido || !datosPedido.pedido_id) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere pedido_id para generar token QR'
        });
      }

      const resultado = QRService.generarToken(datosPedido);

      res.status(201).json({
        success: true,
        data: resultado,
        mensaje: 'Token QR generado exitosamente'
      });
    } catch (error) {
      console.error('Error en generarToken:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Valida un token QR
   * GET /api/qr/validar/:token
   */
  static async validarToken(req, res) {
    try {
      const { token } = req.params;

      const resultado = QRService.validarToken(token);

      if (!resultado.valido) {
        return res.status(400).json({
          success: false,
          error: resultado.razon,
          data: resultado
        });
      }

      res.status(200).json({
        success: true,
        data: {
          valido: true,
          pedido_id: resultado.registro.pedido_id,
          cafeteria_id: resultado.registro.cafeteria_id,
          estado: resultado.registro.estado,
          expires_at: resultado.registro.expires_at
        },
        mensaje: 'Token válido'
      });
    } catch (error) {
      console.error('Error en validarToken:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Marca un token como usado (retiro de pedido)
   * POST /api/qr/usar/:token
   */
  static async usarToken(req, res) {
    try {
      const { token } = req.params;

      const resultado = QRService.usarToken(token);

      res.status(200).json({
        success: true,
        data: resultado,
        mensaje: 'Token marcado como usado'
      });
    } catch (error) {
      console.error('Error en usarToken:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtiene información de un token
   * GET /api/qr/info/:token
   */
  static async obtenerInfo(req, res) {
    try {
      const { token } = req.params;

      const info = QRService.obtenerInformacionToken(token);

      if (!info) {
        return res.status(404).json({
          success: false,
          error: 'Token no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: info
      });
    } catch (error) {
      console.error('Error en obtenerInfo:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Genera un QR visual (mock para pruebas)
   * POST /api/qr/generar-imagen/:token
   */
  static async generarQRVisual(req, res) {
    try {
      const { token } = req.params;
      
      const info = QRService.obtenerInformacionToken(token);
      if (!info) {
        return res.status(404).json({
          success: false,
          error: 'Token no encontrado'
        });
      }

      const qr = QRService.generarQRMock(token);

      res.status(200).json({
        success: true,
        data: qr,
        mensaje: 'QR generado (mock)'
      });
    } catch (error) {
      console.error('Error en generarQRVisual:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Limpia tokens expirados (mantenimiento)
   * POST /api/qr/limpiar
   */
  static async limpiarExpirados(req, res) {
    try {
      const resultado = QRService.limpiarTokensExpirados();

      res.status(200).json({
        success: true,
        data: resultado
      });
    } catch (error) {
      console.error('Error en limpiarExpirados:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = QRController;