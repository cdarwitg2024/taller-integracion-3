const supabase = require('../config/supabase');

const TableName = 'PRODUCTOS';

const ProductosService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, CATEGORIAS(nombre)')
      .eq('activo', true);
    
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, CATEGORIAS(nombre)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, CATEGORIAS(nombre)')
      .eq('cafeteria_id', cafeteriaId)
      .eq('activo', true);
    
    if (error) throw error;
    return data;
  },

  async getByCategoria(categoriaId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, CATEGORIAS(nombre)')
      .eq('categoria_id', categoriaId)
      .eq('activo', true);
    
    if (error) throw error;
    return data;
  },

  async create(producto) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(producto)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateStock(id, cantidad) {
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
  }
};

module.exports = ProductosService;