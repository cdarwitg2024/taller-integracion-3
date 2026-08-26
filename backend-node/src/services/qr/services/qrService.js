const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const QRModel = require('../models/qrModel');

class QRService {
  static generarToken(datosPedido) {
    if (!datosPedido || !datosPedido.pedido_id) {
      throw new Error('Se requiere pedido_id para generar token QR');
    }

    const token = uuidv4();
    
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

    const registro = QRModel.guardarToken(token, datos);
    
    return {
      token: registro.token,
      qr_data: {
        token: registro.token,
        pedido_id: registro.pedido_id,
        created_at: registro.created_at,
        expires_at: registro.expires_at
      },
      qr_metadata: {
        tipo: 'RETIRO_PEDIDO',
        version: '1.0',
        formato: 'UUID'
      }
    };
  }

  /**

   * @param {string} token - Token a codificar en el QR
   * @param {Object} options - Opciones de generación
   * @returns {Promise<string>} - Imagen QR en formato Base64
   */
  static async generarImagenQR(token, options = {}) {
    // Verificar que el token existe (opcional, para pruebas podemos saltar esta validación)
    const registro = QRModel.obtenerToken(token);
    if (!registro) {
      // Para pruebas, permitimos tokens simulados
      console.warn(`⚠️ Token ${token} no encontrado en base de datos, generando QR de prueba`);
    }

    // Datos que se codificarán en el QR
    const qrData = {
      token: token,
      tipo: 'RETIRO_PEDIDO',
      timestamp: new Date().toISOString()
    };

    // Configuración por defecto para el QR
    const defaultOptions = {
      errorCorrectionLevel: 'H', // Alta corrección de errores
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    const config = { ...defaultOptions, ...options };

    try {
      // Generar QR en formato Base64
      const qrImage = await QRCode.toDataURL(JSON.stringify(qrData), config);
      return qrImage;
    } catch (error) {
      console.error('Error generando QR:', error);
      throw new Error(`Error al generar imagen QR: ${error.message}`);
    }
  }

  /**
   * ✅ NUEVO: Genera imagen QR como Buffer (para servir como PNG)
   */
  static async generarImagenQRBuffer(token, options = {}) {
    const qrData = {
      token: token,
      tipo: 'RETIRO_PEDIDO',
      timestamp: new Date().toISOString()
    };

    const defaultOptions = {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    const config = { ...defaultOptions, ...options };

    try {
      const buffer = await QRCode.toBuffer(JSON.stringify(qrData), config);
      return buffer;
    } catch (error) {
      console.error('Error generando QR buffer:', error);
      throw new Error(`Error al generar imagen QR: ${error.message}`);
    }
  }

  /**
   * Valida un token QR
   */
  static validarToken(token) {
    if (!token) {
      return {
        valido: false,
        razon: 'Token no proporcionado'
      };
    }

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
   * Marca un token como usado
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
   * Genera un QR mock para pruebas (legacy)
   */
  static generarQRMock(token) {
    return {
      token: token,
      qr_image: `data:image/png;base64,${Buffer.from(token).toString('base64')}`,
      formato: 'mock_base64',
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