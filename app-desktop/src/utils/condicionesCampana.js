export const campanaAceptada = campana => Boolean(
  campana?.confirmada_por_dueno && campana.version_condiciones?.trim() &&
  campana.version_confirmada?.trim() === campana.version_condiciones.trim()
);

export const claveCondiciones = campana => campana ? JSON.stringify([
  campana.cafeteria_id, campana.id, campana.version_condiciones,
  campana.tasa_descuento, campana.tasa_comision, campana.vigencia_desde, campana.vigencia_hasta,
]) : null;

export const formatearTasa = tasa => Number(tasa || 0).toLocaleString('es-CL', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export const formatearFecha = fecha => {
  if (!fecha) return 'No especificada';
  const date = new Date(fecha);
  if (!Number.isFinite(date.getTime())) return 'No especificada';
  return date.toLocaleString('es-CL', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const estadoConvenio = (campana, ahora = Date.now()) => {
  const estado = String(campana?.estado || '').trim().toLowerCase();

  if (['pausada', 'desactivado', 'desactivada'].includes(estado)) {
    return { label: 'Desactivado', color: 'default' };
  }
  if (estado === 'finalizada') return { label: 'Finalizado', color: 'default' };
  if (['borrador', 'pendiente_aceptacion', 'propuesto', 'propuesta'].includes(estado) || !campanaAceptada(campana)) {
    return { label: 'Propuesto', color: 'warning' };
  }

  const inicio = Date.parse(campana.vigencia_desde);
  const fin = Date.parse(campana.vigencia_hasta);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
    return { label: 'Vigencia inválida', color: 'error' };
  }
  if (ahora < inicio) return { label: 'Programado', color: 'info' };
  if (ahora >= fin) return { label: 'Vencido', color: 'default' };
  if (['activa', 'aceptada'].includes(estado)) return { label: 'Activo', color: 'success' };
  return { label: 'Estado no reconocido', color: 'default' };
};
