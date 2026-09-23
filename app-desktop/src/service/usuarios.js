import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'usuarios';
// Campos seguros que nunca exponen password_hash ni tokens sensibles
const SAFE_USER_FIELDS = 'id, rol_id, nombre, apellido, email, telefono, foto_url, activo, ultima_conexion, creado_en, actualizado_en, auth_user_id';

export const usuarios = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select(`${SAFE_USER_FIELDS}, roles(*)`)
          .eq('activo', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar usuarios:', err);
      }
    }
    return [];
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select(`${SAFE_USER_FIELDS}, roles(*)`)
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar usuario por id:', err);
      }
    }
    return null;
  },

  async getByEmail(email) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select(`${SAFE_USER_FIELDS}, roles(*)`)
          .eq('email', email)
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar usuario por email:', err);
      }
    }
    return null;
  },

  async getByRol(rolId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select(SAFE_USER_FIELDS)
          .eq('rol_id', rolId)
          .eq('activo', true);
        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al consultar usuarios por rol:', err);
      }
    }
    return [];
  },

  async loginDueno(email, password) {
    // 1. Autenticación segura del lado del servidor mediante Supabase GoTrue Auth
    if (isSupabaseConfigured) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError && authData?.user) {
          // Obtener perfil sin exponer hashes
          const { data: userProfile } = await supabase
            .from(TABLE)
            .select(`${SAFE_USER_FIELDS}, roles(*)`)
            .eq('auth_user_id', authData.user.id)
            .single();

          const rolNombre = userProfile?.roles?.nombre || authData.user?.user_metadata?.rol;

          // Regla BR-06 y CA-01: Restricción estricta de roles para Dueño
          if (rolNombre && rolNombre.toLowerCase() !== 'dueño') {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'Acceso denegado. Interfaz exclusiva para Dueños.',
            };
          }

          return { success: true, user: userProfile || authData.user };
        }
      } catch (err) {
        console.warn('Error en Supabase Auth:', err);
      }
    }

    // Fallback de desarrollo: activo ÚNICAMENTE en entorno de desarrollo (import.meta.env.DEV)
    if (import.meta.env.DEV) {
      const devEmail = import.meta.env?.VITE_DEV_ADMIN_EMAIL || 'dueno@coffeefaster.cl';
      const devPass = import.meta.env?.VITE_DEV_ADMIN_PASSWORD || '123456';

      if (email === devEmail && password === devPass) {
        return {
          success: true,
          user: {
            id: 1,
            nombre: 'Administrador',
            apellido: 'Dueño',
            email: devEmail,
            roles: { nombre: 'dueño' },
          },
        };
      }
    }

    return { success: false, error: 'Correo o Contraseña incorrectos.' };
  },

  async loginEmpleado(email, password) {
    // 1. Autenticación segura del lado del servidor mediante Supabase GoTrue Auth
    if (isSupabaseConfigured) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError && authData?.user) {
          // Obtener perfil sin exponer hashes
          const { data: userProfile } = await supabase
            .from(TABLE)
            .select(`${SAFE_USER_FIELDS}, roles(*)`)
            .eq('auth_user_id', authData.user.id)
            .single();

          const rolNombre = userProfile?.roles?.nombre || authData.user?.user_metadata?.rol;

          // Restricción para Empleado
          if (rolNombre && rolNombre.toLowerCase() !== 'empleado') {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'Acceso denegado. Interfaz exclusiva para Empleados.',
            };
          }

          return { success: true, user: userProfile || authData.user };
        }
      } catch (err) {
        console.warn('Error en Supabase Auth:', err);
      }
    }

    // Fallback de desarrollo: activo ÚNICAMENTE en entorno de desarrollo (import.meta.env.DEV)
    if (import.meta.env.DEV) {
      const devEmail = import.meta.env?.VITE_DEV_EMPLEADO_EMAIL || 'empleado@coffeefaster.cl';
      const devPass = import.meta.env?.VITE_DEV_EMPLEADO_PASSWORD || '123456';

      if (email === devEmail && password === devPass) {
        return {
          success: true,
          user: {
            id: 2,
            nombre: 'Juan',
            apellido: 'Empleado',
            email: devEmail,
            roles: { nombre: 'empleado' },
            cafeteria_id: 1,
          },
        };
      }
    }

    return { success: false, error: 'Correo o Contraseña incorrectos.' };
  },

  async create(usuario) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(usuario)
      .select(SAFE_USER_FIELDS)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select(SAFE_USER_FIELDS)
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

export default usuarios;
