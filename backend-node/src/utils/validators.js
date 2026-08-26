class Validators {
  static isValidCafeteriaId(id) {
    return id && typeof id === 'string' && id.startsWith('cafe_');
  }

  static isValidHora(hora) {
    if (!hora) return false;
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(hora);
  }

  static isValidTasaLlegada(tasa) {
    return tasa !== undefined && 
           typeof tasa === 'number' && 
           tasa > 0 && 
           tasa < 10;
  }

  static isValidCantidad(cantidad) {
    return cantidad !== undefined && 
           typeof cantidad === 'number' && 
           Number.isInteger(cantidad) &&
           cantidad > 0 && 
           cantidad <= 10;
  }

  static sanitizarString(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
  }

  static formatearFecha(fecha) {
    return new Date(fecha).toISOString();
  }
}

module.exports = Validators;