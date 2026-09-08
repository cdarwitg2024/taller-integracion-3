const { supabase } = require('./supabase');

const TABLE = 'detalles_pedido';

const detallesPedido = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, pedidos(*), productos(*)');
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, pedidos(*), productos(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByPedido(pedidoId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*)')
      .eq('pedido_id', pedidoId);
    if (error) throw error;
    return data;
  },

  async create(detalle) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(detalle)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createMany(detalles) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(detalles)
      .select();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
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
  },

  async deleteByPedido(pedidoId) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('pedido_id', pedidoId);
    if (error) throw error;
    return true;
  }
};

module.exports = detallesPedido;
