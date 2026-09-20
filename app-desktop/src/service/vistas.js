import { supabase, isSupabaseConfigured } from './supabase';

export const vistas = {
  async getVentasDiarias() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vista_ventas_dia')
          .select('*')
          .order('fecha', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar vista_ventas_dia:', err);
      }
    }
    return [];
  },

  async getVentasDiariasByCafeteria(cafeteriaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vista_ventas_dia')
          .select('*')
          .eq('cafeteria_id', cafeteriaId)
          .order('fecha', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar vista_ventas_dia por cafeteria:', err);
      }
    }
    return [];
  },

  async getVentasByRangoFecha(fechaInicio, fechaFin) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vista_ventas_dia')
          .select('*')
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar vista_ventas_dia por rango:', err);
      }
    }
    return [];
  }
};

export default vistas;
