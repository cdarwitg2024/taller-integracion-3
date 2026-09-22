const { supabase } = require('./supabase');

const TABLE = 'cafeteria_usuarios';

const cafeteriaUsuarios = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*), cafeterias(*)');
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*), cafeterias(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*)')
      .eq('cafeteria_id', cafeteriaId);
    if (error) throw error;
    return data;
  },

  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*)')
      .eq('usuario_id', usuarioId);
    if (error) throw error;
    return data;
  },

  async create(registro) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(registro)
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
  },

  async deleteByUsuarioCafeteria(usuarioId, cafeteriaId) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('cafeteria_id', cafeteriaId);
    if (error) throw error;
    return true;
  }
};

module.exports = cafeteriaUsuarios;
