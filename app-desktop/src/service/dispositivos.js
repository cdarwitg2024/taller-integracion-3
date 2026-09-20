import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'dispositivos';

export const dispositivos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*)')
          .eq('activo', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener dispositivos:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener dispositivo por id:', err);
      }
    }
    return null;
  },

  async getByUsuario(usuarioId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('usuario_id', usuarioId)
          .eq('activo', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener dispositivos por usuario:', err);
      }
    }
    return [];
  },

  async getByToken(token) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('token_fcm', token)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener dispositivo por token:', err);
      }
    }
    return null;
  },

  async create(dispositivo) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(dispositivo)
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

export default dispositivos;
