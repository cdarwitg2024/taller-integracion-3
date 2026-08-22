// Datos mock para pruebas de QR
// En producción, esto vendría de Supabase

class QRModel {
  // Almacenamiento en memoria para pruebas
  static tokens = new Map();

  /**
   * Guarda un token QR en memoria
   * @param {string} token - Token UUID generado
   * @param {Object} data - Datos del pedido asociado
   */
  static guardarToken(token, data) {
    const registro = {
      token,
      pedido_id: data.pedido_id || null,
      cafeteria_id: data.cafeteria_id || null,
      estado: 'activo', // activo, usado, expirado
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(), // 15 min
      metadata: data.metadata || {}
    };
    
    this.tokens.set(token, registro);
    return registro;
  }

  /**
   * Obtiene un token por su valor
   */
  static obtenerToken(token) {
    return this.tokens.get(token) || null;
  }

  /**
   * Actualiza el estado de un token
   */
  static actualizarEstado(token, estado) {
    const registro = this.tokens.get(token);
    if (registro) {
      registro.estado = estado;
      if (estado === 'usado') {
        registro.used_at = new Date().toISOString();
      }
      this.tokens.set(token, registro);
      return registro;
    }
    return null;
  }

  /**
   * Verifica si un token es válido
   */
  static validarToken(token) {
    const registro = this.tokens.get(token);
    if (!registro) {
      return { valido: false, razon: 'Token no encontrado' };
    }
    
    if (registro.estado === 'usado') {
      return { valido: false, razon: 'Token ya fue utilizado' };
    }
    
    if (registro.estado === 'expirado') {
      return { valido: false, razon: 'Token expirado' };
    }
    
    if (new Date() > new Date(registro.expires_at)) {
      registro.estado = 'expirado';
      this.tokens.set(token, registro);
      return { valido: false, razon: 'Token expirado por tiempo' };
    }
    
    return { valido: true, registro };
  }

  /**
   * Limpia tokens expirados (para mantenimiento)
   */
  static limpiarExpirados() {
    const ahora = new Date();
    let contador = 0;
    
    for (const [token, registro] of this.tokens) {
      if (new Date(registro.expires_at) < ahora) {
        registro.estado = 'expirado';
        this.tokens.set(token, registro);
        contador++;
      }
    }
    
    return contador;
  }

  // Para pruebas, limpiar todos los tokens
  static limpiarTodos() {
    this.tokens.clear();
  }
}

module.exports = QRModel;