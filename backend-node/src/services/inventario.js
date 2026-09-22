const supabase = require('../config/supabase');

const TableName = 'MOVIMIENTOS_INVENTARIO';

const InventarioService = {
  async getByProducto(productoId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), PRODUCTOS(nombre)')
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