import type { CampanaAfiliados } from '../services/campanasAfiliados';

// Ejemplo informativo de C01: productos a precio normal, sin cargos adicionales.
// No cotiza un pedido ni registra un descuento o una comisión.
export function ejemploCampanaCarrito(
  campana: Pick<CampanaAfiliados, 'tipo' | 'tasa_descuento' | 'tasa_comision'>,
  subtotal = 10000,
) {
  const tasas = [campana.tasa_descuento, campana.tasa_comision];
  if (campana.tipo !== 'carrito_completo' || !Number.isSafeInteger(subtotal) || subtotal < 0
    || tasas.some(tasa => typeof tasa !== 'number' || !Number.isFinite(tasa) || tasa < 0 || tasa > 100)) {
    return null;
  }
  // Tasas oficiales con hasta dos decimales; redondeo al peso, mitad hacia arriba.
  const descuento = Math.floor((subtotal * Math.round(campana.tasa_descuento! * 100) + 5000) / 10000);
  const subtotalConDescuento = subtotal - descuento;
  const comision = Math.floor((subtotalConDescuento * Math.round(campana.tasa_comision! * 100) + 5000) / 10000);
  return { subtotal, descuento, subtotalConDescuento, comision };
}
