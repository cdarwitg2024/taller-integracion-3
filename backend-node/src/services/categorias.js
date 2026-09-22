const supabase = require('../config/supabase');

const TableName = 'CATEGORIAS';

const CategoriasService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*');
    
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

  async create(categoria) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(categoria)
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

module.exports = CategoriasService;