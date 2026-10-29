const supabase = require('../../config/supabase');
const { productosMock } = require('../../utils/productosMock');

const TableName = 'productos';
const CategoriasTableName = 'categorias';

// Memoria local como respaldo / fallback resiliente
let memoriaProductos = productosMock.map(p => ({ ...p }));

function findEnMemoria(id) {
  return memoriaProductos.find(p => String(p.id) === String(id)) || null;
}

const ProductosService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, categorias(nombre)')
        .eq('activo', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en getAll:', err.message);
      return memoriaProductos.filter(p => p.activo);
    }
  },

  async getById(id) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, categorias(nombre)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en getById:', err.message);
      return findEnMemoria(id);
    }
  },

  async getByCafeteria(cafeteriaId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, categorias(nombre)')
        .eq('cafeteria_id', cafeteriaId)
        .eq('activo', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en getByCafeteria:', err.message);
      return memoriaProductos.filter(p => String(p.cafeteria_id) === String(cafeteriaId) && p.activo);
    }
  },

  async getByCategoria(categoriaId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, categorias(nombre)')
        .eq('categoria_id', categoriaId)
        .eq('activo', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en getByCategoria:', err.message);
      return memoriaProductos.filter(p => String(p.categoria_id) === String(categoriaId) && p.activo);
    }
  },

  async create(producto) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .insert(producto)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en create:', err.message);
      const nuevo = { id: String(memoriaProductos.length + 1), ...producto };
      memoriaProductos.push(nuevo);
      return nuevo;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en update:', err.message);
      const producto = findEnMemoria(id);
      if (producto) Object.assign(producto, updates);
      return producto;
    }
  },

  async updateStock(id, cantidad) {
    try {
      const { data: producto, error: fetchError } = await supabase
        .from(TableName)
        .select('stock')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const nuevoStock = producto.stock + cantidad;

      const { data, error } = await supabase
        .from(TableName)
        .update({ stock: nuevoStock })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('productos.service: fallback a mock en updateStock:', err.message);
      const producto = findEnMemoria(id);
      if (producto) producto.stock += cantidad;
      return producto;
    }
  }
};

module.exports = ProductosService;