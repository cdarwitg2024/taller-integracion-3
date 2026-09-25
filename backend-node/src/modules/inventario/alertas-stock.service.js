const InventarioService = require('./inventario.service');

const AlertasStockService = {
  async verificarAlertasDeProducto(productoId) {
    await InventarioService.getByProducto(productoId);
    return {
      producto_id: productoId,
      alertas: []
    };
  },

  async obtenerAlertasActivas() {
    return [];
  }
};

module.exports = AlertasStockService;