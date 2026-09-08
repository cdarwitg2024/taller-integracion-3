const { supabase } = require('./supabase');

const TABLE = 'dispositivos';

const dispositivos = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*)')
      .eq('activo', true);
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('activo', true);
    if (error) throw error;
    return data;
  },

  async getByToken(token) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('token_fcm', token)
      .single();
    if (error) throw error;
    return data;
  },

  async create(dispositivo) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(dispositivo)
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

module.exports = dispositivos;
