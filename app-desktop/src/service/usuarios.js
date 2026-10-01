import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'usuarios';
// Campos seguros que nunca exponen password_hash ni tokens sensibles
const SAFE_USER_FIELDS = 'id, rol_id, nombre, apellido, email, telefono, foto_url, activo, ultima_conexion, creado_en, actualizado_en, auth_user_id';

// Función para normalizar errores técnicos y presentar mensajes profesionales al usuario
export function normalizeAuthError(authError) {
  if (!authError) return 'Error de autenticación. Verifique sus credenciales.';

  const rawMsg = typeof authError === 'string' ? authError : authError?.message || '';
  const rawLower = rawMsg.toLowerCase();

  // Errores de red / conexión / fetch
  if (
    rawLower.includes('failed to fetch') ||
    rawLower.includes('network') ||
    rawLower.includes('fetch') ||
    rawLower.includes('load failed') ||
    rawLower.includes('connection') ||
    rawLower.includes('timeout') ||
    rawLower.includes('econnrefused') ||
    authError?.name === 'AuthRetryableFetchError' ||
    authError?.status === 0
  ) {
    return 'No se pudo conectar con el servidor. Verifique su conexión a internet o el estado del servicio.';
  }

  if (
    rawLower.includes('invalid login credentials') ||
    rawLower.includes('invalid_grant')
  ) {
    return 'Credenciales incorrectas. Verifique su correo y contraseña.';
  }

  if (rawLower.includes('email not confirmed')) {
    return 'El correo electrónico aún no ha sido verificado.';
  }

  if (authError?.status === 429 || rawLower.includes('too many') || rawLower.includes('rate limit')) {
    return 'Demasiados intentos fallidos. Intente más tarde por motivos de seguridad.';
  }

  if (rawLower.includes('user not found')) {
    return 'No existe una cuenta registrada con este correo electrónico.';
  }

  if (rawMsg && !rawLower.includes('error:') && !rawLower.includes('typeerror') && !rawLower.includes('fetch')) {
    return rawMsg;
  }

  return 'Ocurrió un error inesperado al validar sus credenciales. Intente nuevamente.';
}

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
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'El servicio de autenticación Supabase no está configurado o no está disponible.',
      };
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'Por favor ingresa tanto el correo como la contraseña.',
      };
    }

    try {
      // 1. Autenticación estricta con Supabase Auth (GoTrue)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (authError || !authData?.user) {
        return { success: false, error: normalizeAuthError(authError) };
      }

      // 2. Consulta de perfil y rol en la tabla usuarios de Supabase
      const { data: userProfile, error: profileError } = await supabase
        .from(TABLE)
        .select(`${SAFE_USER_FIELDS}, roles(*), cafeteria_usuarios(*)`)
        .eq('auth_user_id', authData.user.id)
        .single();

      if (profileError || !userProfile) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'No se encontró el perfil de usuario registrado en la base de datos de Supabase.',
        };
      }

      // 3. Verificación de estado de cuenta activa
      if (userProfile.activo === false || userProfile.activo === 'false') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Esta cuenta se encuentra desactivada. Contacte al administrador.',
        };
      }

      // 4. Verificación estricta de Rol: Debe ser Dueño
      const rolNombre = userProfile?.roles?.nombre || authData.user?.user_metadata?.rol;
      if (!rolNombre || rolNombre.toLowerCase() !== 'dueño') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Acceso denegado. Esta cuenta no cuenta con permisos de Dueño.',
        };
      }

      // 5. Vincular cafetería asignada
      const cafeteriaAsignada = userProfile.cafeteria_usuarios?.[0]?.cafeteria_id || null;

      // 6. Registrar última conexión
      try {
        await supabase
          .from(TABLE)
          .update({ ultima_conexion: new Date().toISOString() })
          .eq('id', userProfile.id);
      } catch (e) {
        // No bloqueante
      }

      const usuarioFinal = {
        ...userProfile,
        cafeteria_id: cafeteriaAsignada || 1,
      };

      return { success: true, user: usuarioFinal };
    } catch (err) {
      console.error('Error en loginDueno con Supabase:', err);
      return {
        success: false,
        error: normalizeAuthError(err),
      };
    }
  },

  async loginEmpleado(email, password) {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'El servicio de autenticación Supabase no está configurado o no está disponible.',
      };
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'Por favor ingresa tanto el correo como la contraseña.',
      };
    }

    try {
      // 1. Autenticación estricta con Supabase Auth (GoTrue)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (authError || !authData?.user) {
        return { success: false, error: normalizeAuthError(authError) };
      }

      // 2. Consulta de perfil y rol en la tabla usuarios de Supabase
      const { data: userProfile, error: profileError } = await supabase
        .from(TABLE)
        .select(`${SAFE_USER_FIELDS}, roles(*), cafeteria_usuarios(*)`)
        .eq('auth_user_id', authData.user.id)
        .single();

      if (profileError || !userProfile) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'No se encontró el perfil de usuario registrado en la base de datos de Supabase.',
        };
      }

      // 3. Verificación de estado de cuenta activa
      if (userProfile.activo === false || userProfile.activo === 'false') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Esta cuenta se encuentra desactivada. Contacte al administrador.',
        };
      }

      // 4. Verificación estricta de Rol: Debe ser Empleado
      const rolNombre = userProfile?.roles?.nombre || authData.user?.user_metadata?.rol;
      if (!rolNombre || rolNombre.toLowerCase() !== 'empleado') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Acceso denegado. Esta cuenta no cuenta con permisos de Empleado.',
        };
      }

      // 5. Vincular cafetería asignada
      const cafeteriaAsignada = userProfile.cafeteria_usuarios?.[0]?.cafeteria_id || null;

      // 6. Registrar última conexión
      try {
        await supabase
          .from(TABLE)
          .update({ ultima_conexion: new Date().toISOString() })
          .eq('id', userProfile.id);
      } catch (e) {
        // No bloqueante
      }

      const usuarioFinal = {
        ...userProfile,
        cafeteria_id: cafeteriaAsignada || 1,
      };

      return { success: true, user: usuarioFinal };
    } catch (err) {
      console.error('Error en loginEmpleado con Supabase:', err);
      return {
        success: false,
        error: normalizeAuthError(err),
      };
    }
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
