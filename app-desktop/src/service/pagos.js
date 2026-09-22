const { supabase } = require('./supabase');

const TABLE = 'pagos';

const pagos = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, pedidos(*), metodos_pago(*)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, pedidos(*), metodos_pago(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByPedido(pedidoId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, metodos_pago(*)')
      .eq('pedido_id', pedidoId);
    if (error) throw error;
    return data;
  },

  async getByReferencia(referencia) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, pedidos(*), metodos_pago(*)')
      .eq('referencia_transaccion', referencia)
      .single();
    if (error) throw error;
    return data;
  },

  async create(pago) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(pago)
      .select()
      .single();
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
  }
};

module.exports = pagos;
