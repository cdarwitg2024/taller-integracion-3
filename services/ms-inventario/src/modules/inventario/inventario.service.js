const supabase = require('../../config/supabase');

const TableName = 'movimientos_inventario';

const InventarioService = {
  async getByProducto(productoId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, usuarios(nombre, apellido), productos(nombre)')
      .eq('producto_id', productoId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(movimiento) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(movimiento)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

module.exports = InventarioService;
