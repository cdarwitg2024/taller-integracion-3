const CafeteriasService = require('./cafeterias.service');
const ProductosService = require('./productos.service');

async function obtenerCafeterias(req, res) {
  try {
    const cafeterias = await CafeteriasService.getAll();
    return res.status(200).json(cafeterias || []);
  } catch (error) {
    console.error('Error al obtener cafeterías:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function obtenerProductosPorCafeteria(req, res) {
  try {
    const cafeteria_id = Number(req.params.cafeteria_id);

    const cafeteria = await CafeteriasService.getById(cafeteria_id);

    if (!cafeteria) {
      return res.status(404).json({ error: 'Cafetería no encontrada' });
    }

    const productos = await ProductosService.getByCafeteria(cafeteria_id);

    return res.status(200).json(productos || []);
  } catch (error) {
    console.error('Error al obtener productos de la cafetería:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtenerCafeterias, obtenerProductosPorCafeteria };