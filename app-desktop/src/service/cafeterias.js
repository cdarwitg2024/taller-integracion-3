const { supabase } = require('./supabase');

const TABLE = 'cafeterias';

const cafeterias = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, campus_sedes(*, universidades(*))')
      .eq('activa', true);
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, campus_sedes(*, universidades(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByCampus(campusId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('campus_id', campusId)
      .eq('activa', true);
    if (error) throw error;
    return data;
  },

  async create(cafeteria) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(cafeteria)
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

module.exports = cafeterias;
