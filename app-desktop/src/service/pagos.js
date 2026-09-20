import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'pagos';

export const pagos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, pedidos(*), metodos_pago(*)')
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener pagos:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, pedidos(*), metodos_pago(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener pago por id:', err);
      }
    }
    return null;
  },

  async getByPedido(pedidoId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, metodos_pago(*)')
          .eq('pedido_id', pedidoId);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener pagos por pedido:', err);
      }
    }
    return [];
  },

  async getByReferencia(referencia) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, pedidos(*), metodos_pago(*)')
          .eq('referencia_transaccion', referencia)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener pago por referencia:', err);
      }
    }
    return null;
  },

  async create(pago) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(pago)
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

export default pagos;
