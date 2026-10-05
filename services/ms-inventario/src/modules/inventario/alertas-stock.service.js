const supabase = require('../../config/supabase');

const ProductosTable = 'productos';

function bajoMinimo(producto) {
  return producto.stock_minimo != null && Number(producto.stock) <= Number(producto.stock_minimo);
}

const AlertasStockService = {
  // Productos que alcanzaron o quedaron bajo su stock mínimo
  async obtenerAlertasActivas() {
    const { data, error } = await supabase
      .from(ProductosTable)
      .select('id, nombre, cafeteria_id, stock, stock_minimo')
      .eq('activo', true);

    if (error) throw error;
    return (data || []).filter(bajoMinimo).map(p => ({
      ...p,
      tipo_alerta: 'stock_bajo'
    }));
  },

  async verificarAlertasDeProducto(productoId) {
    const { data, error } = await supabase
      .from(ProductosTable)
      .select('id, nombre, cafeteria_id, stock, stock_minimo')
      .eq('id', productoId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { producto_id: productoId, alertas: [] };
    }

    return {
      producto_id: data.id,
      producto: data.nombre,
      stock: data.stock,
      stock_minimo: data.stock_minimo,
      alertas: bajoMinimo(data) ? ['stock_bajo'] : []
    };
  }
};

module.exports = AlertasStockService;
