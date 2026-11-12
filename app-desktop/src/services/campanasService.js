import { supabase, isSupabaseConfigured } from './supabase';
import { usuarios } from './usuarios';

async function autorizar(cafeteriaId) {
  if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
    throw new Error('No tienes una cafetería asociada.');
  }
  const idNum = Number(cafeteriaId);
  if (!Number.isSafeInteger(idNum) || idNum <= 0) {
    throw new Error('Identificador de cafetería inválido.');
  }

  // Si existe usuarios.getPerfilSesion, comprobar que sea dueño
  if (usuarios && typeof usuarios.getPerfilSesion === 'function') {
    const perfil = await usuarios.getPerfilSesion();
    if (perfil && perfil.success) {
      const rol = String(perfil.rol || '').trim().toLowerCase();
      if (!['dueño', 'dueno'].includes(rol)) {
        throw new Error('Solo el dueño de la cafetería puede confirmar las condiciones de campaña.');
      }
      const perfCafId = Number(perfil.user?.cafeteria_id ?? perfil.user?.cafeteriaId);
      if (Number.isSafeInteger(perfCafId) && perfCafId !== idNum) {
        throw new Error('No estás autorizado para administrar esta cafetería.');
      }
    }
  }
}

function comprobarError(error) {
  if (!error) return;
  if (['PGRST205', '42P01'].includes(error.code)) {
    throw new Error('El esquema de campañas no está disponible en la base de datos.');
  }
  throw new Error(error.message || 'Error de comunicación con Supabase.');
}

export const campanasService = {
  /**
   * Obtiene la campaña de carrito completo vigente para la cafetería
   */
  async obtenerCampanaVigente(cafeteriaId) {
    await autorizar(cafeteriaId);

    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from('campanas')
      .select('id, cafeteria_id, nombre, descripcion, tipo, estado, version_condiciones, tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta, confirmada_por_dueno, fecha_confirmacion, usuario_confirma_id, version_confirmada, creado_en')
      .eq('cafeteria_id', cafeteriaId)
      .in('estado', ['pendiente_aceptacion', 'activa'])
      .gte('vigencia_hasta', ahora)
      .order('confirmada_por_dueno', { ascending: true })
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    comprobarError(error);
    return data || null;
  },

  /**
   * Lista todas las campañas asociadas a la cafetería
   */
  async listar(cafeteriaId) {
    await autorizar(cafeteriaId);

    const { data, error } = await supabase
      .from('campanas')
      .select('*')
      .eq('cafeteria_id', cafeteriaId)
      .order('creado_en', { ascending: false });

    comprobarError(error);
    return data || [];
  },

  /**
   * Confirma y acepta las condiciones de la campaña por parte del dueño.
   * - Atómica: Ejecutada exclusivamente en la base de datos vía RPC con bloqueo FOR UPDATE.
   * - Idempotente: Si ya está confirmada con la misma versión, retorna sin duplicar ni generar error.
   * - Segura: La RPC valida sesión (auth.uid), rol de dueño, cafetería y correspondencia estricta de versión.
   */
  async confirmarCondiciones({ campanaId, cafeteriaId, usuarioId, version }) {
    await autorizar(cafeteriaId);

    const idCampana = Number(campanaId);
    if (!Number.isSafeInteger(idCampana) || idCampana <= 0) {
      throw new Error('Identificador de campaña inválido.');
    }

    const versionTexto = String(version || '').trim();
    if (!versionTexto) {
      throw new Error('La versión de condiciones es requerida para confirmar.');
    }

    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('Cliente RPC de Supabase no disponible.');
    }

    const { data, error } = await supabase.rpc('confirmar_condiciones_campana', {
      p_campana_id: idCampana,
      p_cafeteria_id: Number(cafeteriaId),
      p_usuario_id: usuarioId ? Number(usuarioId) : null,
      p_version: versionTexto,
    });

    comprobarError(error);

    if (!data) {
      throw new Error('No se pudo confirmar la campaña en el servidor.');
    }

    return data;
  },
};

export default campanasService;
