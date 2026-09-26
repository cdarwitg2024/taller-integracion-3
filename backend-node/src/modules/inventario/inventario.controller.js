const InventarioService = require('./inventario.service');
const AlertasStockService = require('./alertas-stock.service');

async function obtenerMovimientos(req, res) {
  try {
    const { producto_id } = req.params;
    const movimientos = await InventarioService.getByProducto(producto_id);
    return res.status(200).json(movimientos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function obtenerAlertas(req, res) {
  try {
    const alertas = await AlertasStockService.obtenerAlertasActivas();
    return res.status(200).json(alertas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function verificarAlertaProducto(req, res) {
  try {
    const { producto_id } = req.params;
    const resultado = await AlertasStockService.verificarAlertasDeProducto(producto_id);
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { obtenerMovimientos, obtenerAlertas, verificarAlertaProducto };