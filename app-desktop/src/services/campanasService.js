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

    const { data, error } = await supabase
      .from('campanas')
      .select('id, cafeteria_id, nombre, descripcion, tipo, estado, version_condiciones, tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta, confirmada_por_dueno, fecha_confirmacion, usuario_confirma_id, version_confirmada, creado_en')
      .eq('cafeteria_id', cafeteriaId)
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
   * - Idempotente: Si ya está confirmada, no duplica el registro ni genera error.
   * - Robusta: Si Supabase o la red fallan, lanza excepción y no permite que el error aparezca como éxito.
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

    // Intentar confirmación atómica mediante RPC en Supabase
    let resRpc = null;
    let rpcNoExiste = false;

    if (typeof supabase.rpc === 'function') {
      try {
        const { data, error } = await supabase.rpc('confirmar_condiciones_campana', {
          p_campana_id: idCampana,
          p_cafeteria_id: Number(cafeteriaId),
          p_usuario_id: usuarioId ? Number(usuarioId) : null,
          p_version: versionTexto,
        });

        if (error) {
          // Si el código indica que la función no existe, recurrir al fallback
          if (['PGRST202', '42883'].includes(error.code)) {
            rpcNoExiste = true;
          } else {
            throw new Error(error.message || 'Error al confirmar las condiciones en el servidor.');
          }
        } else {
          resRpc = data;
        }
      } catch (err) {
        if (!rpcNoExiste) throw err;
      }
    } else {
      rpcNoExiste = true;
    }

    if (resRpc) {
      return resRpc;
    }

    // Fallback directo a la tabla campanas con verificación de estado previo (idempotencia)
    const { data: actual, error: errConsulta } = await supabase
      .from('campanas')
      .select('id, cafeteria_id, confirmada_por_dueno, version_confirmada, fecha_confirmacion, estado')
      .eq('id', idCampana)
      .eq('cafeteria_id', cafeteriaId)
      .single();

    comprobarError(errConsulta);

    if (!actual) {
      throw new Error('No se encontró la campaña o no pertenece a tu cafetería.');
    }

    // Si ya estaba confirmada, retornar el estado existente sin duplicar ni reescribir
    if (actual.confirmada_por_dueno) {
      return actual;
    }

    const nuevoEstado = actual.estado === 'pendiente_aceptacion' || actual.estado === 'borrador'
      ? 'activa'
      : actual.estado;

    const fechaAhora = new Date().toISOString();
    const { data: updated, error: errUpdate } = await supabase
      .from('campanas')
      .update({
        confirmada_por_dueno: true,
        fecha_confirmacion: fechaAhora,
        usuario_confirma_id: usuarioId ? Number(usuarioId) : null,
        version_confirmada: versionTexto,
        estado: nuevoEstado,
        actualizado_en: fechaAhora,
      })
      .eq('id', idCampana)
      .eq('cafeteria_id', cafeteriaId)
      .select()
      .single();

    comprobarError(errUpdate);

    if (!updated) {
      throw new Error('No se pudo persistir la confirmación en Supabase.');
    }

    return updated;
  },
};

export default campanasService;
