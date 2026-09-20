import { supabase, isSupabaseConfigured } from './supabase';

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
      cafeteria_id: nuevoProducto.cafeteria_id || 1,
      categoria_id: nuevoProducto.categoria_id || null,
      nombre: nuevoProducto.nombre,
      descripcion: nuevoProducto.descripcion || '',
      precio: Number(nuevoProducto.precio || 0),
      stock: Number(nuevoProducto.stock || 0),
      stock_minimo: Number(nuevoProducto.stock_minimo || nuevoProducto.minimo || 0),
      imagen_url: nuevoProducto.imagen_url || null,
      activo: true,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .insert(dbPayload)
          .select('*, categorias(*)')
          .single();

        if (!error && data) {
          const item = normalizeProducto({ ...data, unidad: nuevoProducto.unidad });
          const current = getStoredProductos();
          saveStoredProductos([item, ...current]);
          return item;
        }
      } catch (err) {
        console.warn('Error al insertar en Supabase, guardando localmente:', err);
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
    if (updates.categoria_id !== undefined) dbPayload.categoria_id = updates.categoria_id;
    if (updates.activo !== undefined) dbPayload.activo = updates.activo;
    dbPayload.actualizado_en = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .update(dbPayload)
          .eq('id', id)
          .select('*, categorias(*)')
          .single();

        if (!error && data) {
          const updatedItem = normalizeProducto({
            ...data,
            unidad: updates.unidad,
            categoria: updates.categoria || data.categorias?.nombre,
          });
          const current = getStoredProductos();
          const newList = current.map((p) => (p.id === id ? updatedItem : p));
          saveStoredProductos(newList);
          return updatedItem;
        }
      } catch (err) {
        console.warn('Error al actualizar en Supabase, guardando en local:', err);
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

        if (!error) {
          const current = getStoredProductos();
          saveStoredProductos(current.filter((p) => p.id !== id));
          return true;
        }
      } catch (err) {
        console.warn('Error al eliminar en Supabase:', err);
      }
    }

    const current = getStoredProductos();
    saveStoredProductos(current.filter((p) => p.id !== id));
    return true;
  },

  async updateStock(id, nuevoStock) {
    return this.update(id, { stock: Number(nuevoStock) });
  }
};

export const productosService = productos;
export default productos;
