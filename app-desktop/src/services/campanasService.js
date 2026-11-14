import { supabase } from './supabase';
import { usuarios } from './usuarios';
import { campanaAceptada } from '../utils/condicionesCampana';

async function autorizar(cafeteriaId) {
  if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
    throw new Error('No tienes una cafetería asociada.');
  }
  const idNum = Number(cafeteriaId);
  if (!Number.isSafeInteger(idNum) || idNum <= 0) {
    throw new Error('Identificador de cafetería inválido.');
  }

  const perfil = await usuarios.getPerfilSesion();
  if (!perfil?.success || perfil.user?.activo === false) {
    throw new Error('No se pudo validar la sesión del dueño.');
  }
  if (!['dueño', 'dueno'].includes(String(perfil.rol || '').trim().toLowerCase())) {
    throw new Error('Solo el dueño de la cafetería puede confirmar las condiciones de campaña.');
  }
  if (Number(perfil.user?.cafeteria_id ?? perfil.user?.cafeteriaId) !== idNum) {
    throw new Error('No estás autorizado para administrar esta cafetería.');
  }
  return idNum;
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
    const id = await autorizar(cafeteriaId);
    const { data, error } = await supabase
      .rpc('obtener_campana_vigente', { p_cafeteria_id: id })
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
  async confirmarCondiciones({ campanaId, cafeteriaId, version }) {
    const idCafeteria = await autorizar(cafeteriaId);

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
      p_cafeteria_id: idCafeteria,
      p_version: versionTexto,
    });

    comprobarError(error);

    if (!campanaAceptada(data) || Number(data.id) !== idCampana ||
        Number(data.cafeteria_id) !== idCafeteria || data.version_confirmada.trim() !== versionTexto) {
      throw new Error('El servidor no confirmó la campaña y versión solicitadas.');
    }

    return data;
  },
};

export default campanasService;
