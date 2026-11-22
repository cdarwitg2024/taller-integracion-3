import { ApiError, apiPost } from './backendClient';
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
  let respuesta: T;
  try {
    respuesta = await apiPost<T>('/api/pedidos', intento.cuerpo, { timeoutMs, claveIdempotencia: intento.clave });
  } catch (error) {
    // Los HTTP 400 y 401 de este endpoint ocurren antes del cobro.
    // Red, timeout y respuestas inciertas conservan el registro original.
    if (error instanceof ApiError && [400, 401].includes(error.status) && !error.resultadoIncierto) {
      await reiniciarIntentoCompra(usuarioId);
    }
    throw error;
  }
  // Solo un rechazo explícito permite una nueva compra sin recuperar un cobro.
  if ((respuesta as { pedido?: { ok?: boolean } } | null)?.pedido?.ok === false) {
    await reiniciarIntentoCompra(usuarioId);
  }
  return respuesta;
}
