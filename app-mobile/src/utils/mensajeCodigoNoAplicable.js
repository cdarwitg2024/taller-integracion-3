export function mensajeCodigoNoAplicable(motivo) {
  switch (motivo) {
    case 'codigo_invalido':
      return 'El código no es válido para esta cafetería.';
    case 'codigo_desactivado':
    case 'campana_no_iniciada':
    case 'campana_pausada':
    case 'campana_finalizada':
    case 'campana_no_activa':
    case 'campana_no_aceptada':
    case 'condiciones_incompletas':
      return 'El código está inactivo o su campaña no está disponible.';
    case 'beneficio_usado':
      return 'Ya usaste este beneficio y no puedes aplicarlo otra vez.';
    default:
      return 'Este código no se puede aplicar a tu carrito.';
  }
}
