import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'roles';

const defaultRoles = [
  { id: 1, nombre: 'estudiante', descripcion: 'Consulta menús, realiza pedidos, paga y retira con QR via Android', activo: true },
  { id: 2, nombre: 'empleado', descripcion: 'Opera el KDS en Windows para preparar y validar retiros QR', activo: true },
  { id: 3, nombre: 'dueño', descripcion: 'Administra productos, stock, personal, métricas y recibe alertas de IA', activo: true },
];

export const roles = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('activo', true);
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Error al obtener roles:', err);
      }
    }
    return defaultRoles;
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
        console.warn('Error al obtener rol por id:', err);
      }
    }
    return defaultRoles.find((r) => r.id === id) || null;
  },

  async getByNombre(nombre) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('nombre', nombre)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al obtener rol por nombre:', err);
      }
    }
    return defaultRoles.find((r) => r.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  },

  async create(rol) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(rol)
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

export default roles;
