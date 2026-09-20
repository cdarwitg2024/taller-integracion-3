import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'alertas_stock';

const defaultAlertas = [
  {
    id: 1,
    cafeteria_id: 1,
    producto_id: 2,
    stock_actual: 5,
    stock_minimo: 12,
    mensaje: 'Leche entera ha caído por debajo del umbral mínimo (5 de 12 L).',
    leida: false,
    creado_en: new Date(Date.now() - 40 * 60000).toISOString(),
    productos: { nombre: 'Leche entera' },
  },
  {
    id: 2,
    cafeteria_id: 1,
    producto_id: 5,
    stock_actual: 11,
    stock_minimo: 15,
    mensaje: 'Medialuna cuenta con solo 11 unidades disponibles (mínimo 15 un).',
    leida: false,
    creado_en: new Date(Date.now() - 120 * 60000).toISOString(),
    productos: { nombre: 'Medialuna' },
  },
];

export const alertasStock = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), productos(*)')
          .order('creado_en', { ascending: false });

        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Error al consultar alertas_stock:', err);
      }
    }
    return defaultAlertas;
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), productos(*)')
          .eq('id', id)
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar alerta por id:', err);
      }
    }
    return defaultAlertas.find((a) => a.id === id) || null;
  },

  async getByCafeteria(cafeteriaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*)')
          .eq('cafeteria_id', cafeteriaId)
          .order('creado_en', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar alertas por cafeteria:', err);
      }
    }
    return defaultAlertas.filter((a) => a.cafeteria_id === cafeteriaId);
  },

  async getNoLeidas(cafeteriaId = 1) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, productos(*)')
          .eq('cafeteria_id', cafeteriaId)
          .eq('leida', false)
          .order('creado_en', { ascending: false });

        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Error al consultar alertas no leídas:', err);
      }
    }
    return defaultAlertas.filter((a) => !a.leida);
  },

  async create(alerta) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(alerta)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async marcarLeida(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .update({ leida: true })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al marcar alerta leída en Supabase:', err);
      }
    }
    const item = defaultAlertas.find((a) => a.id === id);
    if (item) item.leida = true;
    return item;
  },

  async delete(id) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn('Error al eliminar alerta:', err);
      }
    }
    return true;
  }
};

export default alertasStock;
