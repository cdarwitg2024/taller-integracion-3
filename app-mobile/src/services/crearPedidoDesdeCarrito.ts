import { apiPost } from './backendClient';
import { obtenerIntentoCompra, marcarIntentoEnviado, reiniciarIntentoCompra } from './intentoCompra';

export type RetiroCheckout = { franja: string; codigo?: string };
type ProductoCarrito = { id: number; quantity: number; price: number };

export async function crearPedidoDesdeCarrito<T>(
  cafeteriaId: number,
  productos: ProductoCarrito[],
  retiro: RetiroCheckout,
  timeoutMs: number,
  usuarioId: string,
) {
  const codigo = retiro.codigo?.trim();
  const cuerpo = {
    cafeteria_id: cafeteriaId,
    items: productos.map(({ id, quantity, price }) => ({
      producto_id: id,
      cantidad: quantity,
      precio_esperado: price,
    })),
    franja_retiro: retiro.franja,
    ...(codigo ? { codigo } : {}),
  };
  const intento = await obtenerIntentoCompra(usuarioId, cuerpo);
  await marcarIntentoEnviado(usuarioId, intento.clave);
  const respuesta = await apiPost<T>('/api/pedidos', intento.cuerpo, { timeoutMs, claveIdempotencia: intento.clave });
  // Solo un rechazo explícito permite una nueva compra sin recuperar un cobro.
  if ((respuesta as { pedido?: { ok?: boolean } } | null)?.pedido?.ok === false) {
    await reiniciarIntentoCompra(usuarioId);
  }
  return respuesta;
}
