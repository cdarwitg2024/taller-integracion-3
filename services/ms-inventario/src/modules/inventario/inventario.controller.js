const InventarioService = require('./inventario.service');
const AlertasStockService = require('./alertas-stock.service');
const StockService = require('./stock.service');

function respuestaError(res, error) {
  if (error.codigo === 409) return res.status(409).json({ error: error.message });
  if (error.codigo === 503) return res.status(503).json({ error: error.message });
  return res.status(500).json({ error: error.message });
}

async function obtenerMovimientos(req, res) {
  try {
    const { producto_id } = req.params;
    const movimientos = await InventarioService.getByProducto(producto_id);
    return res.status(200).json(movimientos);
  } catch (error) {
    return respuestaError(res, error);
  }
}

async function obtenerAlertas(req, res) {
  try {
    const alertas = await AlertasStockService.obtenerAlertasActivas();
    return res.status(200).json(alertas);
  } catch (error) {
    return respuestaError(res, error);
  }
}

async function verificarAlertaProducto(req, res) {
  try {
    const { producto_id } = req.params;
    const resultado = await AlertasStockService.verificarAlertasDeProducto(producto_id);
    return res.status(200).json(resultado);
  } catch (error) {
    return respuestaError(res, error);
  }
}

// POST /api/inventario/verificar - Consumido por MS-Pedidos antes de crear un pedido.
// body: { productos: [{ producto_id, cantidad }] }
async function verificarDisponibilidad(req, res) {
  try {
    const { productos } = req.body || {};
    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir una lista de productos.' });
    }
    await StockService.verificarDisponibilidad(productos);
    return res.status(200).json({ ok: true, verificados: productos.length });
  } catch (error) {
    return respuestaError(res, error);
  }
}

// POST /api/inventario/movimientos - Consumido por MS-Pedidos para descontar (salida)
// o reponer (entrada) stock.
// body: { tipo: 'salida'|'entrada', producto_id, cantidad, usuario_id?, motivo? }
async function crearMovimiento(req, res) {
  try {
    const { tipo, producto_id, cantidad, usuario_id, motivo } = req.body || {};

    if (!producto_id || !cantidad) {
      return res.status(400).json({ error: 'Debe enviar producto_id y cantidad.' });
    }
    if (tipo !== 'salida' && tipo !== 'entrada') {
      return res.status(400).json({ error: 'El campo "tipo" debe ser "salida" o "entrada".' });
    }

    const fn = tipo === 'salida' ? StockService.descontarStock : StockService.reponerStock;
    const resultado = await fn({ producto_id, cantidad, usuario_id, motivo });
    return res.status(201).json({
      ok: true,
      tipo,
      stock: resultado ? resultado.stock : null,
      producto_id
    });
  } catch (error) {
    return respuestaError(res, error);
  }
}

module.exports = {
  obtenerMovimientos,
  obtenerAlertas,
  verificarAlertaProducto,
  verificarDisponibilidad,
  crearMovimiento
};
