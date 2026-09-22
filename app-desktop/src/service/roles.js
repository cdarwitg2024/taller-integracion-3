const { supabase } = require('./supabase');

const TABLE = 'roles';

const roles = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('activo', true);
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByNombre(nombre) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('nombre', nombre)
      .single();
    if (error) throw error;
    return data;
  },

  async create(rol) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(rol)
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

module.exports = roles;
