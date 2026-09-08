const { supabase } = require('./supabase');

const TABLE = 'campus_sedes';

const campusSedes = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, universidades(*)')
      .eq('activa', true);
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, universidades(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByUniversidad(universidadId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('universidad_id', universidadId)
      .eq('activa', true);
    if (error) throw error;
    return data;
  },

  async create(sede) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(sede)
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

module.exports = campusSedes;
