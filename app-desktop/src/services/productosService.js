import { supabase, isSupabaseConfigured } from './supabaseClient';

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

export const productosService = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('PRODUCTOS')
          .select('*, CATEGORIAS(nombre)');
        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a productos mock:', err);
      }
    }
    return mockProductos;
  }
};

export default productosService;
