import { apiPost } from './backendClient';
import { obtenerClaveIntentoCompra } from './intentoCompra';

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
  const claveIdempotencia = await obtenerClaveIntentoCompra(usuarioId, cuerpo);
  return apiPost<T>('/api/pedidos', cuerpo, { timeoutMs, claveIdempotencia });
}
