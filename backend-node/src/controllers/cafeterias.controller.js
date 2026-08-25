const { cafeteriasMock } = require('../utils/cafeteriasMock');
const { productosMock } = require('../utils/productosMock');

function obtenerCafeterias(req, res) {
  return res.status(200).json(cafeteriasMock);
}

function obtenerProductosPorCafeteria(req, res) {
  const { cafeteria_id } = req.params;

  const cafeteriaExiste = cafeteriasMock.some(c => c.id === cafeteria_id);
  if (!cafeteriaExiste) {
    return res.status(404).json({ error: 'Cafetería no encontrada' });
  }

  const productos = productosMock.filter(p => p.cafeteria_id === cafeteria_id && p.activo);

  return res.status(200).json(productos);
}

module.exports = { obtenerCafeterias, obtenerProductosPorCafeteria };