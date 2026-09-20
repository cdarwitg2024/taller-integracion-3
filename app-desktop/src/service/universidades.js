import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'universidades';

export const universidades = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('activa', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener universidades:', err);
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
        console.warn('Error al obtener universidad por id:', err);
      }
    }
    return null;
  },

  async create(universidad) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(universidad)
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

export default universidades;
