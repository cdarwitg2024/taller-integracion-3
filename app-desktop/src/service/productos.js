import { supabase, isSupabaseConfigured } from './supabase.js';

const TABLE = 'productos';

const initialMockProductos = [
  {
    id: 1,
    cafeteria_id: 1,
    categoria_id: 1,
    nombre: 'Café en grano',
    descripcion: 'Granos de café tostado de especialidad',
    precio: 12000,
    stock: 18,
    stock_minimo: 24,
    minimo: 24,
    unidad: 'kg',
    categoria: 'CAFÉ',
    catColor: '#8D6E63',
    catBg: '#EFEBE9',
    activo: true,
  },
  {
    id: 2,
    cafeteria_id: 1,
    categoria_id: 2,
    nombre: 'Leche entera',
    descripcion: 'Leche fresca pasteurizada',
    precio: 1400,
    stock: 5,
    stock_minimo: 12,
    minimo: 12,
    unidad: 'L',
    categoria: 'LÁCTEOS',
    catColor: '#5C6BC0',
    catBg: '#E8EAF6',
    activo: true,
  },
  {
    id: 3,
    cafeteria_id: 1,
    categoria_id: 6,
    nombre: 'Chocolate',
    descripcion: 'Cacao en polvo seleccionado',
    precio: 4500,
    stock: 15,
    stock_minimo: 8,
    minimo: 8,
    unidad: 'kg',
    categoria: 'INSUMOS',
    catColor: '#7E57C2',
    catBg: '#EDE7F6',
    activo: true,
  },
  {
    id: 4,
    cafeteria_id: 1,
    categoria_id: 3,
    nombre: 'Croissant',
    descripcion: 'Croissant horneado estilo francés',
    precio: 2000,
    stock: 24,
    stock_minimo: 10,
    minimo: 10,
    unidad: 'un',
    categoria: 'PANADERÍA',
    catColor: '#8D6E63',
    catBg: '#EFEBE9',
    activo: true,
  },
  {
    id: 5,
    cafeteria_id: 1,
    categoria_id: 4,
    nombre: 'Medialuna',
    descripcion: 'Medialuna artesanal',
    precio: 1200,
    stock: 11,
    stock_minimo: 15,
    minimo: 15,
    unidad: 'un',
    categoria: 'REPOSTERÍA',
    catColor: '#D84315',
    catBg: '#FBE9E7',
    activo: true,
  },
  {
    id: 6,
    cafeteria_id: 1,
    categoria_id: 5,
    nombre: 'Té Chai',
    descripcion: 'Té especiado aromático',
    precio: 2200,
    stock: 22,
    stock_minimo: 10,
    minimo: 10,
    unidad: 'un',
    categoria: 'TÉ',
    catColor: '#2E7D32',
    catBg: '#E8F5E9',
    activo: true,
  },
  {
    id: 7,
    cafeteria_id: 1,
    categoria_id: 7,
    nombre: 'Vaso 12 oz',
    descripcion: 'Vasos térmicos descartables',
    precio: 150,
    stock: 150,
    stock_minimo: 100,
    minimo: 100,
    unidad: 'un',
    categoria: 'DESECHABLES',
    catColor: '#6A1B9A',
    catBg: '#F3E5F5',
    activo: true,
  },
  {
    id: 8,
    cafeteria_id: 1,
    categoria_id: 6,
    nombre: 'Azúcar',
    descripcion: 'Sobres de azúcar granulada',
    precio: 1200,
    stock: 20,
    stock_minimo: 10,
    minimo: 10,
    unidad: 'kg',
    categoria: 'INSUMOS',
    catColor: '#7E57C2',
    catBg: '#EDE7F6',
    activo: true,
  },
];

const getStoredProductos = () => {
  try {
    const stored = localStorage.getItem('coffeefaster_productos');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error al leer productos de localStorage:', err);
  }
  localStorage.setItem('coffeefaster_productos', JSON.stringify(initialMockProductos));
  return initialMockProductos;
};

const saveStoredProductos = (prods) => {
  try {
    localStorage.setItem('coffeefaster_productos', JSON.stringify(prods));
  } catch (err) {
    console.error('Error al guardar productos en localStorage:', err);
  }
};

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

export const productos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), categorias(*)')
          .eq('activo', true)
          .is('eliminado_en', null)
          .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
          const normalized = data.map(normalizeProducto);
          saveStoredProductos(normalized);
          return normalized;
        }
      } catch (err) {
        console.warn('Uso de mock para productos.getAll():', err);
      }
    }
    return getStoredProductos();
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, cafeterias(*), categorias(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          return normalizeProducto(data);
        }
      } catch (err) {
        console.warn('Uso de mock para productos.getById():', err);
      }
    }
    const list = getStoredProductos();
    return list.find((p) => p.id === Number(id) || p.id === id) || null;
  },

  async getByCategoria(categoriaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, categorias(*)')
          .eq('categoria_id', categoriaId)
          .eq('activo', true)
          .is('eliminado_en', null);

        if (!error && data) {
          return data.map(normalizeProducto);
        }
      } catch (err) {
        console.warn('Error al filtrar por categoría:', err);
      }
    }
    const list = getStoredProductos();
    return list.filter((p) => p.categoria_id === Number(categoriaId));
  },

  async create(nuevoProducto) {
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

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .insert(dbPayload)
          .select('*, cafeterias(*), categorias(*)')
          .single();

        if (error) {
          console.error('Error al insertar producto en Supabase:', error);
          throw error;
        }

        if (data) {
          const item = normalizeProducto({ ...data, unidad: nuevoProducto.unidad });
          const current = getStoredProductos();
          saveStoredProductos([item, ...current]);
          return item;
        }
      } catch (err) {
        console.error('Fallo al guardar en Supabase:', err);
        throw err;
      }
    }

    const current = getStoredProductos();
    const fallbackItem = {
      ...nuevoProducto,
      id: Date.now(),
      minimo: dbPayload.stock_minimo,
      stock_minimo: dbPayload.stock_minimo,
      stock: dbPayload.stock,
      unidad: nuevoProducto.unidad || 'un',
      categoria: nuevoProducto.categoria || 'GENERAL',
    };
    saveStoredProductos([fallbackItem, ...current]);
    return fallbackItem;
  },

  async update(id, updates) {
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

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .update(dbPayload)
          .eq('id', id)
          .select('*, cafeterias(*), categorias(*)')
          .single();

        if (error) {
          console.error('Error al actualizar en Supabase:', error);
          throw error;
        }

        if (data) {
          const current = getStoredProductos();
          const existing = current.find((p) => p.id === id);
          const updatedItem = normalizeProducto({
            ...existing,
            ...data,
            ...(updates.unidad !== undefined ? { unidad: updates.unidad } : {}),
            categoria: updates.categoria || data.categorias?.nombre || existing?.categoria,
          });
          const newList = current.map((p) => (p.id === id ? updatedItem : p));
          saveStoredProductos(newList);
          return updatedItem;
        }
      } catch (err) {
        console.error('Fallo al actualizar producto en Supabase:', err);
        throw err;
      }
    }

    const current = getStoredProductos();
    const newList = current.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          ...updates,
          stock: Number(updates.stock ?? p.stock),
          minimo: Number(updates.stock_minimo ?? updates.minimo ?? p.minimo),
          stock_minimo: Number(updates.stock_minimo ?? updates.minimo ?? p.minimo),
        };
      }
      return p;
    });
    saveStoredProductos(newList);
    return newList.find((p) => p.id === id);
  },

  async delete(id) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from(TABLE)
          .update({ activo: false, eliminado_en: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          console.error('Error al eliminar en Supabase:', error);
          throw error;
        }

        const current = getStoredProductos();
        saveStoredProductos(current.filter((p) => p.id !== id));
        return true;
      } catch (err) {
        console.error('Fallo al eliminar producto en Supabase:', err);
        throw err;
      }
    }

    const current = getStoredProductos();
    saveStoredProductos(current.filter((p) => p.id !== id));
    return true;
  },

  /**
   * Operación de Modificación de Precio (FR-46)
   * Separada de la gestión de stock y de la edición general.
   * Valida que el precio sea numérico y estrictamente mayor a 0.
   * Actualiza el registro en Supabase y sincroniza la persistencia local.
   *
   * @param {number|string} id - ID del producto
   * @param {number|string} nuevoPrecio - Nuevo valor de venta en CLP
   * @returns {Promise<Object>} Producto actualizado
   */
  async updatePrecio(id, nuevoPrecio) {
    if (!id) {
      throw new Error('El identificador del producto es requerido.');
    }
    if (nuevoPrecio === '' || nuevoPrecio === null || nuevoPrecio === undefined) {
      throw new Error('El precio es obligatorio.');
    }
    const precioNum = Number(nuevoPrecio);
    if (isNaN(precioNum)) {
      throw new Error('El precio debe ser un valor numérico válido.');
    }
    if (precioNum <= 0) {
      throw new Error('El precio debe ser un número mayor a 0.');
    }

    return this.update(id, { precio: precioNum });
  },

  /**
   * Operación de Modificación de Stock (FR-47)
   * Separada de la gestión de precio y de la edición general.
   * Valida que el stock sea un valor numérico entero no negativo (>= 0).
   * Valida opcionalmente que el stock mínimo no sea negativo (>= 0).
   * Actualiza el registro en Supabase y sincroniza la persistencia local.
   *
   * @param {number|string} id - ID del producto
   * @param {number|string} nuevoStock - Cantidad disponible actual
   * @param {number|string} [nuevoStockMinimo] - Umbral mínimo para alertas de reposición
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateStock(id, nuevoStock, nuevoStockMinimo) {
    if (!id) {
      throw new Error('El identificador del producto es requerido.');
    }
    if (nuevoStock === '' || nuevoStock === null || nuevoStock === undefined) {
      throw new Error('El stock es obligatorio.');
    }
    const stockNum = Number(nuevoStock);
    if (isNaN(stockNum)) {
      throw new Error('El stock debe ser un valor numérico.');
    }
    if (stockNum < 0) {
      throw new Error('El stock no puede ser un valor negativo (debe ser mayor o igual a 0).');
    }
    if (!Number.isInteger(stockNum)) {
      throw new Error('El stock debe ser un número entero mayor o igual a 0.');
    }

    const payload = { stock: stockNum };

    if (nuevoStockMinimo !== undefined && nuevoStockMinimo !== null && nuevoStockMinimo !== '') {
      const minNum = Number(nuevoStockMinimo);
      if (isNaN(minNum)) {
        throw new Error('El stock mínimo debe ser un número válido.');
      }
      if (minNum < 0) {
        throw new Error('El stock mínimo no puede ser un valor negativo (debe ser mayor o igual a 0).');
      }
      if (!Number.isInteger(minNum)) {
        throw new Error('El stock mínimo debe ser un número entero mayor o igual a 0.');
      }
      payload.stock_minimo = minNum;
      payload.minimo = minNum;
    }

    return this.update(id, payload);
  }
};

export const productosService = productos;
export default productos;
