import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'logs_validacion_qr';

export const logsValidacionQr = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), usuarios(*), pedidos(*)')
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener logs_validacion_qr:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), usuarios(*), pedidos(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener log por id:', err);
      }
    }
    return null;
  },

  async getByCafeteria(cafeteriaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), pedidos(*)')
          .eq('cafeteria_id', cafeteriaId)
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener logs por cafeteria:', err);
      }
    }
    return [];
  },

  async getByPedido(pedidoId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), usuarios(*)')
          .eq('pedido_id', pedidoId)
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener logs por pedido:', err);
      }
    }
    return [];
  },

  async create(log) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(log)
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

export default logsValidacionQr;
