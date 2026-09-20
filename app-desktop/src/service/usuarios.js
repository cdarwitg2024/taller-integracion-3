import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'usuarios';

export const usuarios = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, roles(*)')
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
          .select('*, roles(*)')
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
          .select('*, roles(*)')
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
          .select('*')
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
    // 1. Si Supabase Auth está disponible, intentar sign in
    if (isSupabaseConfigured) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          return { success: false, error: 'Correo o Contraseña incorrectos.' };
        }

        if (authData?.user) {
          const { data: userProfile } = await supabase
            .from(TABLE)
            .select('*, roles(*)')
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
        console.warn('Error en Supabase Auth, intentando verificación en tabla usuarios:', err);
      }

      // 2. Consulta directa a tabla usuarios si se autentica fuera de GoTrue
      try {
        const { data: directUser, error: directError } = await supabase
          .from(TABLE)
          .select('*, roles(*)')
          .eq('email', email)
          .single();

        if (!directError && directUser) {
          if (directUser.roles?.nombre && directUser.roles.nombre.toLowerCase() !== 'dueño') {
            return {
              success: false,
              error: 'Acceso denegado. Interfaz exclusiva para Dueños.',
            };
          }
          return { success: true, user: directUser };
        }
      } catch (err) {
        console.warn('Consulta directa usuarios:', err);
      }
    }

    // Fallback de desarrollo configurable exclusivamente vía variables de entorno
    const devEmail = import.meta.env?.VITE_DEV_ADMIN_EMAIL;
    const devPass = import.meta.env?.VITE_DEV_ADMIN_PASSWORD;

    if (devEmail && devPass && email === devEmail && password === devPass) {
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

    return { success: false, error: 'Correo o Contraseña incorrectos.' };
  },

  async create(usuario) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(usuario)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, actualizado_en: new Date().toISOString() })
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

export default usuarios;
