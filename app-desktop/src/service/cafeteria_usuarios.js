import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'cafeteria_usuarios';

export const cafeteriaUsuarios = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), cafeterias(*)');
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar cafeteria_usuarios:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), cafeterias(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar cafeteria_usuario por id:', err);
      }
    }
    return null;
  },

  async getByCafeteria(cafeteriaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*)')
          .eq('cafeteria_id', cafeteriaId);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar usuarios por cafeteria:', err);
      }
    }
    return [];
  },

  async getByUsuario(usuarioId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*)')
          .eq('usuario_id', usuarioId);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar asignaciones por usuario:', err);
      }
    }
    return [];
  },

  async create(registro) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(registro)
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

export default cafeteriaUsuarios;
