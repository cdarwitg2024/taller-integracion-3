import { apiPost } from './backendClient';

type Cotizacion = { subtotal: number; descuento_afiliado: number; total: number };
type Producto = { id: number; quantity: number };

export async function cotizarCarritoAfiliado(cafeteriaId: number, cart: Producto[], codigo: string) {
  const cotizacion = await apiPost<Cotizacion | undefined>('/api/afiliados/cotizaciones', {
    cafeteria_id: cafeteriaId,
    items: cart.map(({ id, quantity }) => ({ producto_id: id, cantidad: quantity })),
    ...(codigo ? { codigo } : {}),
  });

  if (!cotizacion || ![cotizacion.subtotal, cotizacion.descuento_afiliado, cotizacion.total]
    .every(monto => Number.isSafeInteger(monto) && monto >= 0)) {
    throw new Error('Respuesta de cotización inválida');
  }
  return cotizacion;
}
