import { supabase, isSupabaseConfigured } from './supabase';
import { usuarios } from './usuarios';

async function autorizar(cafeteriaId) {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
  if (!Number.isSafeInteger(Number(cafeteriaId)) || Number(cafeteriaId) <= 0) throw new Error('No tienes una cafetería asociada.');
  const perfil = await usuarios.getPerfilSesion();
  if (!perfil.success || !['dueño', 'dueno'].includes(perfil.rol) || Number(perfil.user?.cafeteria_id) !== Number(cafeteriaId)) {
    throw new Error('Tu sesión no permite administrar esta cafetería. Vuelve a iniciar sesión.');
  }
}

function comprobar(error) {
  if (!error) return;
  if (['PGRST205', '42P01'].includes(error.code)) {
    throw new Error('La gestión de promociones aún no está habilitada en la base de datos. Su activación está pendiente.');
  }
  throw new Error(error.message || 'No se pudo guardar en Supabase.');
}

export function validarConfiguracion(form) {
  const nombre = String(form.nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 120) throw new Error('El nombre debe tener entre 2 y 120 caracteres.');
  const telefono = String(form.telefono || '').trim();
  if (telefono && !/^\+?[\d\s()-]{6,25}$/.test(telefono)) throw new Error('Ingresa un teléfono válido.');
  const apertura = form.hora_apertura || null;
  const cierre = form.hora_cierre || null;
  if (Boolean(apertura) !== Boolean(cierre)) throw new Error('Completa ambas horas o deja ambas vacías.');
  if ([apertura, cierre].some(h => h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) throw new Error('Revisa las horas de apertura y cierre.');
  if (apertura && apertura === cierre) throw new Error('La apertura y el cierre deben tener horas diferentes.');
  const imagen = String(form.imagen_url || '').trim();
  if (imagen) {
    try { if (!['http:', 'https:'].includes(new URL(imagen).protocol)) throw new Error(); }
    catch { throw new Error('La imagen debe ser una URL http o https válida.'); }
  }
  const descripcion = String(form.descripcion || '').trim();
  if (descripcion.length > 2000) throw new Error('La descripción admite hasta 2000 caracteres.');
  return { nombre, descripcion: descripcion || null, telefono: telefono || null,
    hora_apertura: apertura, hora_cierre: cierre, imagen_url: imagen || null, activa: Boolean(form.activa) };
}

export function validarPromocion(form) {
  const nombre = String(form.nombre || '').trim();
  const porcentaje = Number(form.descuento_porcentaje);
  if (nombre.length < 3 || nombre.length > 120) throw new Error('El nombre debe tener entre 3 y 120 caracteres.');
  if (!Number.isFinite(porcentaje) || porcentaje < 1 || porcentaje > 99 || Math.abs(Math.round(porcentaje * 100) - porcentaje * 100) > 1e-8) {
    throw new Error('Ingresa un descuento entre 1 y 99 %, con hasta dos decimales.');
  }
  const inicio = form.inicio_en ? new Date(form.inicio_en) : null;
  const fin = form.fin_en ? new Date(form.fin_en) : null;
  if ([inicio, fin].some(d => d && !Number.isFinite(d.getTime()))) throw new Error('Revisa las fechas de vigencia.');
  if (inicio && fin && fin <= inicio) throw new Error('El fin debe ser posterior al inicio.');
  const productoId = form.producto_id ? Number(form.producto_id) : null;
  if (productoId !== null && (!Number.isSafeInteger(productoId) || productoId <= 0)) throw new Error('Selecciona un producto válido.');
  const descripcion = String(form.descripcion || '').trim();
  if (descripcion.length > 2000) throw new Error('La descripción admite hasta 2000 caracteres.');
  return { nombre, descripcion: descripcion || null, descuento_porcentaje: porcentaje,
    producto_id: productoId, activo: Boolean(form.activo), inicio_en: inicio?.toISOString() || null, fin_en: fin?.toISOString() || null };
}

export const configuracionCafeteria = {
  async obtener(cafeteriaId) {
    await autorizar(cafeteriaId);
    const { data, error } = await supabase.from('cafeterias')
      .select('id,nombre,descripcion,telefono,hora_apertura,hora_cierre,imagen_url,activa,actualizado_en,campus_sedes(direccion)')
      .eq('id', cafeteriaId).single();
    comprobar(error);
    if (!data) throw new Error('No se encontró tu cafetería.');
    return data;
  },
  async guardar(cafeteriaId, form, versionAnterior) {
    const payload = validarConfiguracion(form);
    await autorizar(cafeteriaId);
    let query = supabase.from('cafeterias').update({ ...payload, actualizado_en: new Date().toISOString() }).eq('id', cafeteriaId);
    query = versionAnterior ? query.eq('actualizado_en', versionAnterior) : query.is('actualizado_en', null);
    const { data, error } = await query.select('id,nombre,descripcion,telefono,hora_apertura,hora_cierre,imagen_url,activa,actualizado_en,campus_sedes(direccion)').maybeSingle();
    comprobar(error);
    if (!data) throw new Error('La configuración cambió en otra sesión. Recarga antes de guardar.');
    return data;
  },
};

const CAMPOS = 'id,cafeteria_id,producto_id,nombre,descripcion,descuento_porcentaje,activo,inicio_en,fin_en,actualizado_en';
export const promocionesCafeteria = {
  async listar(cafeteriaId) {
    await autorizar(cafeteriaId);
    const { data, error } = await supabase.from('promociones').select(CAMPOS).eq('cafeteria_id', cafeteriaId).order('creado_en', { ascending: false });
    comprobar(error);
    return data || [];
  },
  async guardar(cafeteriaId, form) {
    const payload = validarPromocion(form);
    await autorizar(cafeteriaId);
    let query;
    if (form.id) {
      query = supabase.from('promociones').update({ ...payload, actualizado_en: new Date().toISOString() })
        .eq('id', form.id).eq('cafeteria_id', cafeteriaId).eq('actualizado_en', form.actualizado_en);
    } else {
      query = supabase.from('promociones').insert({ ...payload, cafeteria_id: Number(cafeteriaId) });
    }
    const { data, error } = await query.select(CAMPOS).maybeSingle();
    comprobar(error);
    if (!data) throw new Error('La promoción cambió o ya no está disponible. Actualiza la lista.');
    return data;
  },
  async eliminar(cafeteriaId, promocion) {
    await autorizar(cafeteriaId);
    const { data, error } = await supabase.from('promociones').delete().eq('id', promocion.id)
      .eq('cafeteria_id', cafeteriaId).eq('actualizado_en', promocion.actualizado_en).select('id').maybeSingle();
    comprobar(error);
    if (!data) throw new Error('La promoción cambió o ya fue eliminada. Actualiza la lista.');
  },
};
