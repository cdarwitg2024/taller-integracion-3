import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'metodos_pago';

export const metodosPago = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('activo', true)
          .order('id', { ascending: true });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener metodos_pago:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener metodo_pago por id:', err);
      }
    }
    return null;
  },

  async getByCodigo(codigo) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('codigo', codigo)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener metodo_pago por codigo:', err);
      }
    }
    return null;
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

export default metodosPago;
