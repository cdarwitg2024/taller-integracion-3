// Servicio de dispositivos (tokens FCM) del cliente móvil.
// Reemplaza al servicio huérfano src/services/dispositivos.js, que consultaba
// la tabla como 'DISPOSITIVOS' (mayúsculas) y por eso nunca funcionó contra
// PostgREST, que distingue mayúsculas de minúsculas.

const supabase = require('../../config/supabase');

const TableName = 'dispositivos';

function ahora() {
  return new Date().toISOString();
}

const DispositivosService = {
  /**
   * Registra (o reactiva) el token FCM de un dispositivo.
   * El token es único por dispositivo: si ya existe se actualiza, y si
   * pertenecer a otro usuario (logout y login con otra cuenta) se reasigna
   * al usuario autenticado.
   */
  async registrarToken({ usuario_id, token, plataforma }) {
    if (!usuario_id) {
      throw new Error('usuario_id es obligatorio para registrar el token');
    }
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new Error('token FCM es obligatorio');
    }

    const tokenFcm = token.trim();
    const plataformaNormalizada = plataforma
      ? String(plataforma).trim().slice(0, 30) || 'desconocida'
      : 'desconocida';

    const { data: existente, error: errorBusqueda } = await supabase
      .from(TableName)
      .select('*')
      .eq('token_fcm', tokenFcm)
      .maybeSingle();

    if (errorBusqueda) throw new Error(errorBusqueda.message);

    if (existente) {
      const { data, error } = await supabase
        .from(TableName)
        .update({
          usuario_id,
          plataforma: plataformaNormalizada,
          activo: true,
          ultima_conexion: ahora()
        })
        .eq('id', existente.id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await supabase
      .from(TableName)
      .insert({
        usuario_id,
        token_fcm: tokenFcm,
        plataforma: plataformaNormalizada,
        activo: true,
        ultima_conexion: ahora(),
        creado_en: ahora()
      })
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Tokens activos de un usuario. El filtro de `activo` se aplica en memoria
   * porque filas registradas antes de existir la columna pueden tener NULL.
   */
  async getActivosByUsuario(usuarioId) {
    if (!usuarioId) return [];

    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('usuario_id', usuarioId);

    if (error) throw new Error(error.message);
    return (data || []).filter((dispositivo) => dispositivo.activo !== false);
  },

  /** Marca tokens como inactivos (los que FCM reportó como inválidos). */
  async desactivarPorTokens(tokens) {
    const lista = (tokens || []).filter(Boolean);
    if (lista.length === 0) return 0;

    const { error } = await supabase
      .from(TableName)
      .update({ activo: false, ultima_conexion: ahora() })
      .in('token_fcm', lista);

    if (error) throw new Error(error.message);
    return lista.length;
  },

  /** Desregistra el token propio del usuario (logout en la app). */
  async desregistrarToken({ usuario_id, token }) {
    if (!usuario_id || !token) return null;

    const { data: existente, error: errorBusqueda } = await supabase
      .from(TableName)
      .select('*')
      .eq('token_fcm', token.trim())
      .maybeSingle();

    if (errorBusqueda) throw new Error(errorBusqueda.message);
    if (!existente || String(existente.usuario_id) !== String(usuario_id)) {
      return null;
    }

    const { data, error } = await supabase
      .from(TableName)
      .update({ activo: false, ultima_conexion: ahora() })
      .eq('id', existente.id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};

module.exports = DispositivosService;
