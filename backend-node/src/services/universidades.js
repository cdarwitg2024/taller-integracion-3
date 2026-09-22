const supabase = require('../config/supabase');

const TableName = 'UNIVERSIDADES';

const UniversidadesService = {
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

  async create(universidad) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(universidad)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = UniversidadesService;