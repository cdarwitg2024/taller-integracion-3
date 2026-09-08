const { supabase } = require('./supabase');

const vistas = {
  async getVentasDiarias() {
    const { data, error } = await supabase
      .from('vista_ventas_dia')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getVentasDiariasByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from('vista_ventas_dia')
      .select('*')
      .eq('cafeteria_id', cafeteriaId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getVentasByRangoFecha(fechaInicio, fechaFin) {
    const { data, error } = await supabase
      .from('vista_ventas_dia')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }
};

module.exports = vistas;
