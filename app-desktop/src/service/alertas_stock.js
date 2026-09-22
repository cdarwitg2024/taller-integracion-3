const { supabase } = require('./supabase');

const TABLE = 'alertas_stock';

const alertasStock = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), productos(*)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), productos(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*)')
      .eq('cafeteria_id', cafeteriaId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getNoLeidas(cafeteriaId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, productos(*)')
      .eq('cafeteria_id', cafeteriaId)
      .eq('leida', false)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(alerta) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(alerta)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async marcarLeida(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ leida: true })
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

module.exports = alertasStock;
