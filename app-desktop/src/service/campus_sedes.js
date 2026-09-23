import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'campus_sedes';

export const campusSedes = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, universidades(*)')
          .eq('activa', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener campus_sedes:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, universidades(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener campus_sede por id:', err);
      }
    }
    return null;
  },

  async getByUniversidad(universidadId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('universidad_id', universidadId)
          .eq('activa', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener campus_sede por universidad:', err);
      }
    }
    return [];
  },

  async create(sede) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(sede)
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

export default campusSedes;
