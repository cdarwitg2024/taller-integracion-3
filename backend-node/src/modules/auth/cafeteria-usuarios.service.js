const supabase = require('../../config/supabase');

const TableName = 'cafeteria_usuarios';

const CafeteriaUsuariosService = {
  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, usuarios(nombre, apellido, email)')
      .eq('cafeteria_id', cafeteriaId);
    
    if (error) throw error;
    return data;
  },

  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, cafeterias(nombre)')
      .eq('usuario_id', usuarioId);
    
    if (error) throw error;
    return data;
  },

  async create(registro) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(registro)
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

module.exports = CafeteriaUsuariosService;