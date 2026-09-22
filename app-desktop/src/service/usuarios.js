const { supabase } = require('./supabase');

const TABLE = 'usuarios';

const usuarios = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, roles(*)')
      .eq('activo', true);
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, roles(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByEmail(email) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, roles(*)')
      .eq('email', email)
      .single();
    if (error) throw error;
    return data;
  },

  async getByRol(rolId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('rol_id', rolId)
      .eq('activo', true);
    if (error) throw error;
    return data;
  },

  async create(usuario) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(usuario)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, actualizado_en: new Date().toISOString() })
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

module.exports = usuarios;
