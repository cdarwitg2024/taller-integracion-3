import { apiPost } from './backendClient';

export type RetiroCheckout = { franja: string; codigo?: string };
type ProductoCarrito = { id: number; quantity: number; price: number };

export function crearPedidoDesdeCarrito<T>(
  cafeteriaId: number,
  productos: ProductoCarrito[],
  retiro: RetiroCheckout,
  timeoutMs: number,
) {
  const codigo = retiro.codigo?.trim();
  return apiPost<T>('/api/pedidos', {
    cafeteria_id: cafeteriaId,
    items: productos.map(({ id, quantity, price }) => ({
      producto_id: id,
      cantidad: quantity,
      precio_esperado: price,
    })),
    franja_retiro: retiro.franja,
    ...(codigo ? { codigo } : {}),
  }, { timeoutMs });
}
