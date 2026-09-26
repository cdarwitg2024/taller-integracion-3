import { supabase, isSupabaseConfigured } from './supabase.js';

const TABLE = 'productos';

const normalizeProducto = (p) => ({
  ...p,
  minimo: p.stock_minimo ?? p.minimo ?? 0,
  stock_minimo: p.stock_minimo ?? p.minimo ?? 0,
  categoria: p.categorias?.nombre || p.categoria || 'GENERAL',
  cafeteria_nombre: p.cafeterias?.nombre || p.cafeteria_nombre || 'Cafetería Central',
  unidad: p.unidad || 'un',
  catColor: p.catColor || '#8D6E63',
  catBg: p.catBg || '#EFEBE9',
});

function asegurarConexion() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado en las variables de entorno (.env).');
  }
}

export const productos = {
  /**
   * Obtiene todos los productos activos directamente de la base de datos Supabase.
   * Lanza un error estricto si la base de datos está apagada o inaccesible.
   */
  async getAll() {
    asegurarConexion();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), categorias(*)')
      .eq('activo', true)
      .is('eliminado_en', null)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error consultando productos en Supabase:', error);
      throw new Error(`Error de conexión con la base de datos Supabase: ${error.message || 'Sin conexión'}`);
    }

    return (data || []).map(normalizeProducto);
  },

  /**
   * Obtiene un producto por su ID directamente de Supabase.
   */
  async getById(id) {
    asegurarConexion();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*, cafeterias(*), categorias(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error consultando producto por ID en Supabase:', error);
      throw new Error(`Error de conexión con la base de datos Supabase: ${error.message || 'Sin conexión'}`);
    }

    return data ? normalizeProducto(data) : null;
  },

  /**
   * Filtra productos por categoría directamente en Supabase.
   */
  async getByCategoria(categoriaId) {
    asegurarConexion();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*, categorias(*)')
      .eq('categoria_id', categoriaId)
      .eq('activo', true)
      .is('eliminado_en', null);

    if (error) {
      console.error('Error consultando categoría en Supabase:', error);
      throw new Error(`Error de conexión con la base de datos Supabase: ${error.message || 'Sin conexión'}`);
    }

    return (data || []).map(normalizeProducto);
  },

  /**
   * Inserta un nuevo producto directamente en Supabase.
   */
  async create(nuevoProducto) {
    asegurarConexion();

    const dbPayload = {
      cafeteria_id: nuevoProducto.cafeteria_id ? Number(nuevoProducto.cafeteria_id) : 1,
      categoria_id: nuevoProducto.categoria_id ? Number(nuevoProducto.categoria_id) : null,
      nombre: nuevoProducto.nombre,
      descripcion: nuevoProducto.descripcion || '',
      precio: Number(nuevoProducto.precio || 0),
      stock: Number(nuevoProducto.stock || 0),
      stock_minimo: Number(nuevoProducto.stock_minimo || nuevoProducto.minimo || 0),
      imagen_url: nuevoProducto.imagen_url || null,
      activo: nuevoProducto.activo !== undefined ? Boolean(nuevoProducto.activo) : true,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(dbPayload)
      .select('*, cafeterias(*), categorias(*)')
      .single();

    if (error) {
      console.error('Error al insertar producto en Supabase:', error);
      throw new Error(`No se pudo crear el producto en la base de datos: ${error.message || 'Sin conexión'}`);
    }

    return normalizeProducto({ ...data, unidad: nuevoProducto.unidad });
  },

  /**
   * Actualiza los datos de un producto directamente en Supabase.
   */
  async update(id, updates) {
    asegurarConexion();

    const dbPayload = {};
    if (updates.nombre !== undefined) dbPayload.nombre = updates.nombre;
    if (updates.descripcion !== undefined) dbPayload.descripcion = updates.descripcion;
    if (updates.precio !== undefined) dbPayload.precio = Number(updates.precio);
    if (updates.stock !== undefined) dbPayload.stock = Number(updates.stock);
    if (updates.stock_minimo !== undefined || updates.minimo !== undefined) {
      dbPayload.stock_minimo = Number(updates.stock_minimo ?? updates.minimo);
    }
    if (updates.cafeteria_id !== undefined) dbPayload.cafeteria_id = Number(updates.cafeteria_id);
    if (updates.categoria_id !== undefined) dbPayload.categoria_id = updates.categoria_id ? Number(updates.categoria_id) : null;
    if (updates.activo !== undefined) dbPayload.activo = Boolean(updates.activo);
    dbPayload.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .update(dbPayload)
      .eq('id', id)
      .select('*, cafeterias(*), categorias(*)')
      .single();

    if (error) {
      console.error('Error al actualizar en Supabase:', error);
      throw new Error(`No se pudo actualizar el producto en la base de datos: ${error.message || 'Sin conexión'}`);
    }

    return normalizeProducto({
      ...data,
      ...(updates.unidad !== undefined ? { unidad: updates.unidad } : {}),
      categoria: updates.categoria || data.categorias?.nombre,
    });
  },

  /**
   * Elimina lógicamente un producto en Supabase.
   */
  async delete(id) {
    asegurarConexion();

    const { error } = await supabase
      .from(TABLE)
      .update({ activo: false, eliminado_en: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar en Supabase:', error);
      throw new Error(`No se pudo eliminar el producto en la base de datos: ${error.message || 'Sin conexión'}`);
    }

    return true;
  },

  /**
   * Operación de Modificación de Precio (FR-46)
   */
  async updatePrecio(id, nuevoPrecio) {
    if (!id) throw new Error('El identificador del producto es requerido.');
    if (nuevoPrecio === '' || nuevoPrecio === null || nuevoPrecio === undefined) {
      throw new Error('El precio es obligatorio.');
    }
    const precioNum = Number(nuevoPrecio);
    if (isNaN(precioNum)) throw new Error('El precio debe ser un valor numérico válido.');
    if (precioNum <= 0) throw new Error('El precio debe ser un número mayor a 0.');

    return this.update(id, { precio: precioNum });
  },

  /**
   * Operación de Modificación de Stock (FR-47)
   */
  async updateStock(id, nuevoStock, nuevoStockMinimo) {
    if (!id) throw new Error('El identificador del producto es requerido.');
    if (nuevoStock === '' || nuevoStock === null || nuevoStock === undefined) {
      throw new Error('El stock es obligatorio.');
    }
    const stockNum = Number(nuevoStock);
    if (isNaN(stockNum)) throw new Error('El stock debe ser un valor numérico.');
    if (stockNum < 0) throw new Error('El stock no puede ser un valor negativo (debe ser mayor o igual a 0).');
    if (!Number.isInteger(stockNum)) throw new Error('El stock debe ser un número entero mayor o igual a 0.');

    const payload = { stock: stockNum };

    if (nuevoStockMinimo !== undefined && nuevoStockMinimo !== null && nuevoStockMinimo !== '') {
      const minNum = Number(nuevoStockMinimo);
      if (isNaN(minNum)) throw new Error('El stock mínimo debe ser un número válido.');
      if (minNum < 0) throw new Error('El stock mínimo no puede ser un valor negativo (debe ser mayor o igual a 0).');
      if (!Number.isInteger(minNum)) throw new Error('El stock mínimo debe ser un número entero mayor o igual a 0.');
      payload.stock_minimo = minNum;
      payload.minimo = minNum;
    }

    return this.update(id, payload);
  }
};

export const productosService = productos;
export default productos;
