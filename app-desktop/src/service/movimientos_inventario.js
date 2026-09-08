const { supabase } = require('./supabase');

const TABLE = 'movimientos_inventario';

const movimientosInventario = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*), usuarios(*)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*), usuarios(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByProducto(productoId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*)')
      .eq('producto_id', productoId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*)')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(movimiento) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(movimiento)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

module.exports = movimientosInventario;
