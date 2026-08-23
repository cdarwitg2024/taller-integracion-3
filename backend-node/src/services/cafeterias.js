const supabase = require('../config/supabase');

const TableName = 'CAFETERIAS';

const CafeteriasService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('activa', true);
    
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByCampus(campusId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('campus_id', campusId)
      .eq('activa', true);
    
    if (error) throw error;
    return data;
  },

  async create(cafeteria) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(cafeteria)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = CafeteriasService;