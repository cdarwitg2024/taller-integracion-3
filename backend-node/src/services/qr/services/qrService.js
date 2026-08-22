const { v4: uuidv4 } = require('uuid');
const QRModel = require('../models/qrModel');

class QRService {
  /**
   * Genera un nuevo token QR único
   * @param {Object} datosPedido - Datos del pedido
   * @returns {Object} Token generado
   */
  static generarToken(datosPedido) {
    // Validar datos mínimos
    if (!datosPedido || !datosPedido.pedido_id) {
      throw new Error('Se requiere pedido_id para generar token QR');
    }

    // Generar UUID v4 único
    const token = uuidv4();
    
    // Datos adicionales que puede tener el pedido
    const datos = {
      pedido_id: datosPedido.pedido_id,
      cafeteria_id: datosPedido.cafeteria_id || null,
      cliente_id: datosPedido.cliente_id || null,
      metadata: {
        productos: datosPedido.productos || [],
        total: datosPedido.total || 0,
        ...datosPedido.metadata
      }
    };

    // Guardar token en modelo
    const registro = QRModel.guardarToken(token, datos);
    
    return {
      token: registro.token,
      qr_data: {
        token: registro.token,
        pedido_id: registro.pedido_id,
        created_at: registro.created_at,
        expires_at: registro.expires_at
      },
      // Información para generar QR visual
      qr_metadata: {
        tipo: 'RETIRO_PEDIDO',
        version: '1.0',
        formato: 'UUID'
      }
    };
  }

  /**
   * Valida un token QR
   * @param {string} token - Token a validar
   * @returns {Object} Resultado de validación
   */
  static validarToken(token) {
    if (!token) {
      return {
        valido: false,
        razon: 'Token no proporcionado'
      };
    }

    // Verificar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return {
        valido: false,
        razon: 'Formato de token inválido'
      };
    }

    return QRModel.validarToken(token);
  }

  /**
   * Marca un token como usado (cuando se retira el pedido)
   */
  static usarToken(token) {
    const validacion = this.validarToken(token);
    if (!validacion.valido) {
      throw new Error(validacion.razon);
    }

    const actualizado = QRModel.actualizarEstado(token, 'usado');
    return {
      success: true,
      mensaje: 'Token marcado como usado',
      token: actualizado
    };
  }

  /**
   * Obtiene información de un token
   */
  static obtenerInformacionToken(token) {
    const registro = QRModel.obtenerToken(token);
    if (!registro) {
      return null;
    }
    
    return {
      token: registro.token,
      pedido_id: registro.pedido_id,
      estado: registro.estado,
      created_at: registro.created_at,
      expires_at: registro.expires_at,
      cafeteria_id: registro.cafeteria_id,
      metadata: registro.metadata
    };
  }

  /**
   * Simula la generación de un QR para un pedido
   * (Mock para pruebas sin necesidad de librería QR)
   */
  static generarQRMock(token) {
    // En producción, aquí se usaría una librería como qrcode
    return {
      token: token,
      qr_image: `data:image/png;base64,${Buffer.from(token).toString('base64')}`,
      formato: 'mock_base64',
      // Esto es solo para pruebas, en producción se usaría qrcode
      mensaje: 'QR simulado para pruebas'
    };
  }

  /**
   * Limpia tokens expirados
   */
  static limpiarTokensExpirados() {
    const contador = QRModel.limpiarExpirados();
    return {
      mensaje: `Se limpiaron ${contador} tokens expirados`,
      tokens_limpiados: contador
    };
  }
}

module.exports = QRService;