import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'cafeterias';

function asegurarConexion() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado en las variables de entorno.');
  }
}

export const cafeterias = {
  async getAll() {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, campus_sedes(*, universidades(*))')
      .eq('activa', true);

    if (error) {
      console.error('Error al obtener cafeterias de Supabase:', error);
      throw new Error(`Error al obtener cafeterías de la base de datos: ${error.message}`);
    }
    return data || [];
  },

  async getById(id) {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, campus_sedes(*, universidades(*))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener cafeteria por id en Supabase:', error);
      throw new Error(`Error al obtener cafetería de la base de datos: ${error.message}`);
    }
    return data || null;
  },

  async getByCampus(campusId) {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('campus_id', campusId)
      .eq('activa', true);

    if (error) {
      console.error('Error al obtener cafeterias por campus en Supabase:', error);
      throw new Error(`Error al obtener cafeterías por campus: ${error.message}`);
    }
    return data || [];
  },

  async create(cafeteria) {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .insert(cafeteria)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    asegurarConexion();
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
    asegurarConexion();
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export default cafeterias;
