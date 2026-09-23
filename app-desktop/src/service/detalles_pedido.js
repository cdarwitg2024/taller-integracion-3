import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'detalles_pedido';

export const detallesPedido = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, pedidos(*), productos(*)');
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener detalles_pedido:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, pedidos(*), productos(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener detalle por id:', err);
      }
    }
    return null;
  },

  async getByPedido(pedidoId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*)')
          .eq('pedido_id', pedidoId);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener detalles por pedido:', err);
      }
    }
    return [];
  },

  async create(detalle) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(detalle)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createMany(detalles) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(detalles)
      .select();
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
  },

  async deleteByPedido(pedidoId) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('pedido_id', pedidoId);
    if (error) throw error;
    return true;
  }
};

export default detallesPedido;
