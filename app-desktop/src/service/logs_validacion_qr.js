const { supabase } = require('./supabase');

const TABLE = 'logs_validacion_qr';

const logsValidacionQr = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), usuarios(*), pedidos(*)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), usuarios(*), pedidos(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*), pedidos(*)')
      .eq('cafeteria_id', cafeteriaId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByPedido(pedidoId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), usuarios(*)')
      .eq('pedido_id', pedidoId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(log) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(log)
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

module.exports = logsValidacionQr;
