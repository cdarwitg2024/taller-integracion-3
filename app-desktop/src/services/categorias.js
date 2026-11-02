import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'categorias';

function asegurarConexion() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado en las variables de entorno.');
  }
}

export const categorias = {
  async getAll() {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al consultar categorias en Supabase:', error);
      throw new Error(`Error al consultar categorías en la base de datos: ${error.message}`);
    }
    return data || [];
  },

  async getById(id) {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al consultar categoria por id en Supabase:', error);
      throw new Error(`Error al consultar categoría en la base de datos: ${error.message}`);
    }
    return data || null;
  },

  async create(categoria) {
    asegurarConexion();
    const { data, error } = await supabase
      .from(TABLE)
      .insert(categoria)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    asegurarConexion();
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
    asegurarConexion();
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

export default categorias;
