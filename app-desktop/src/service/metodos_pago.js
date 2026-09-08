const { supabase } = require('./supabase');

const TABLE = 'metodos_pago';

const metodosPago = {
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

  async getByCodigo(codigo) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('codigo', codigo)
      .single();
    if (error) throw error;
    return data;
  },

  async create(metodo) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(metodo)
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

module.exports = metodosPago;
