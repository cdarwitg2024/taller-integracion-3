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
