import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'categorias';

const defaultCategorias = [
  { id: 1, nombre: 'CAFÉ', descripcion: 'Granos, café molido y preparaciones a base de espresso' },
  { id: 2, nombre: 'LÁCTEOS', descripcion: 'Leche entera, descremada, vegetal y derivados' },
  { id: 3, nombre: 'PANADERÍA', descripcion: 'Panes, croissants y empanadas saladas' },
  { id: 4, nombre: 'REPOSTERÍA', descripcion: 'Medialunas, galletas, muffins y tortas' },
  { id: 5, nombre: 'TÉ', descripcion: 'Té negro, verde, infusiones y chai' },
  { id: 6, nombre: 'INSUMOS', descripcion: 'Azúcar, jarabes, cacao y aditivos' },
  { id: 7, nombre: 'DESECHABLES', descripcion: 'Vasos térmicos, tapas, servilletas y revolvedores' },
  { id: 8, nombre: 'BEBIDAS FRÍAS', descripcion: 'Jugos naturales, aguas y bebidas embotelladas' },
];

export const categorias = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .order('id', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Error al consultar categorias:', err);
      }
    }
    return defaultCategorias;
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar categoria por id:', err);
      }
    }
    return defaultCategorias.find((c) => c.id === id) || null;
  },

  async create(categoria) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(categoria)
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

export default categorias;
