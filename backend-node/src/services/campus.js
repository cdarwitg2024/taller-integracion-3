const supabase = require('../config/supabase');

const TableName = 'CAMPUS_SEDES';

const CampusService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, UNIVERSIDADES(nombre)');
    
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, UNIVERSIDADES(nombre)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByUniversidad(universidadId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('universidad_id', universidadId);
    
    if (error) throw error;
    return data;
  },

  async create(campus) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(campus)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = CampusService;