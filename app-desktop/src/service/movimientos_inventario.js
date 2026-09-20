import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'movimientos_inventario';

export const movimientosInventario = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*), usuarios(*)')
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener movimientos_inventario:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*), usuarios(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener movimiento por id:', err);
      }
    }
    return null;
  },

  async getByProducto(productoId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*)')
          .eq('producto_id', productoId)
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener movimientos por producto:', err);
      }
    }
    return [];
  },

  async getByUsuario(usuarioId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*)')
          .eq('usuario_id', usuarioId)
          .order('creado_en', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener movimientos por usuario:', err);
      }
    }
    return [];
  },

  async registrarMovimiento({ producto_id, usuario_id, tipo, cantidad, motivo }) {
    const payload = {
      producto_id,
      usuario_id: usuario_id || null,
      tipo, // 'entrada', 'salida', 'ajuste'
      cantidad: Number(cantidad),
      motivo: motivo || 'Ajuste manual desde panel de dueño',
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .insert(payload)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al registrar movimiento en Supabase:', err);
      }
    }
    return { ...payload, id: Date.now(), creado_en: new Date().toISOString() };
  },

  async create(movimiento) {
    return this.registrarMovimiento(movimiento);
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

export default movimientosInventario;
