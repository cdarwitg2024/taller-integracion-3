import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'productos';

const mockProductos = [
  { id: 1, nombre: 'Café Americano', categoria: 'Bebidas Calientes', precio: 1800, disponible: true },
  { id: 2, nombre: 'Capuchino', categoria: 'Bebidas Calientes', precio: 2400, disponible: true },
  { id: 3, nombre: 'Croissant Jamón Queso', categoria: 'Repostería', precio: 2000, disponible: true },
  { id: 4, nombre: 'Sándwich Ave Mayo', categoria: 'Sándwiches', precio: 2800, disponible: true },
  { id: 5, nombre: 'Empanada de Queso', categoria: 'Comidas Rápidas', precio: 1200, disponible: true },
  { id: 6, nombre: 'Muffin de Arándanos', categoria: 'Repostería', precio: 1800, disponible: true },
  { id: 7, nombre: 'Latte Vainilla', categoria: 'Bebidas Calientes', precio: 2600, disponible: true },
  { id: 8, nombre: 'Jugo Natural Naranja', categoria: 'Bebidas Frías', precio: 2200, disponible: true },
];

export const productos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), categorias(*)')
          .eq('activo', true)
          .is('eliminado_en', null);
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Uso de mock para productos.getAll():', e);
      }
    }
    return mockProductos;
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), categorias(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Uso de mock para productos.getById():', e);
      }
    }
    return mockProductos.find(p => p.id === id) || null;
  }
};

export const productosService = productos;
export default productos;
