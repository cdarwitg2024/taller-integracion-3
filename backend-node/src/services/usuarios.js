const supabase = require('../config/supabase');

const TableName = 'USUARIOS';

const UsuariosService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('activo', true);
    
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

  async getByEmail(email) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) throw error;
    return data;
  },

  async create(usuario) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(usuario)
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
  },

  async delete(id) {
    const { error } = await supabase
      .from(TableName)
      .update({ activo: false })
      .eq('id', id);
    
    if (error) throw error;
  }
};

module.exports = UsuariosService;