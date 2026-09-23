import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'cafeterias';

const defaultCafeterias = [
  {
    id: 1,
    nombre: 'Cafetería Central',
    descripcion: 'Punto de venta y retiro principal',
    hora_apertura: '08:00',
    hora_cierre: '19:00',
    activa: true,
  },
];

export const cafeterias = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, campus_sedes(*, universidades(*))')
          .eq('activa', true);
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Error al obtener cafeterias:', err);
      }
    }
    return defaultCafeterias;
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, campus_sedes(*, universidades(*))')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener cafeteria por id:', err);
      }
    }
    return defaultCafeterias.find((c) => c.id === id) || defaultCafeterias[0];
  },

  async getByCampus(campusId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('campus_id', campusId)
          .eq('activa', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener cafeterias por campus:', err);
      }
    }
    return [];
  },

  async create(cafeteria) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(cafeteria)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, actualizado_en: new Date().toISOString() })
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

export default cafeterias;
