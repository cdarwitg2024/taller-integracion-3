const supabase = require('../config/supabase');

const TableName = 'DISPOSITIVOS';

const DispositivosService = {
  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('usuario_id', usuarioId);
    
    if (error) throw error;
    return data;
  },

  async create(dispositivo) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(dispositivo)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateToken(id, tokenFcm) {
    const { data, error } = await supabase
      .from(TableName)
      .update({ 
        token_fcm: tokenFcm,
        ultima_conexion: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = DispositivosService;