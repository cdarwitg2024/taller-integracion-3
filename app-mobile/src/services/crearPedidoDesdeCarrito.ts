import { ApiError, apiPost } from './backendClient';
import { obtenerIntentoCompra, marcarIntentoEnviado, reiniciarIntentoCompra } from './intentoCompra';

export type RetiroCheckout = { franja: string; codigo?: string; totalAceptado?: number };
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
      ...(retiro.totalAceptado === undefined ? { precio_esperado: price } : {}),
    })),
    franja_retiro: retiro.franja,
    ...(codigo ? { codigo } : {}),
    ...(retiro.totalAceptado !== undefined ? { total_aceptado: retiro.totalAceptado } : {}),
  };
  const intento = await obtenerIntentoCompra(usuarioId, cuerpo);
  let respuesta: T;
  try {
    respuesta = await apiPost<T>('/api/pedidos', intento.cuerpo, {
      timeoutMs, claveIdempotencia: intento.clave,
      antesDeEnviar: () => marcarIntentoEnviado(usuarioId, intento.clave),
    });
  } catch (error) {
    // Los HTTP 400 y 401 de este endpoint ocurren antes del cobro.
    // Red, timeout y respuestas inciertas conservan el registro original.
    if (error instanceof ApiError && !error.resultadoIncierto && (
      [400, 401].includes(error.status) ||
      (retiro.totalAceptado !== undefined && esRechazoCotizacion(error))
    )) {
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

function esRechazoCotizacion(error: ApiError) {
  return (error.status === 409 && error.message === 'precio_actualizado') ||
    (error.status === 422 && error.message === 'saldo_insuficiente') ||
    (error.status === 503 && error.message === 'confirmacion_afiliada_no_disponible');
}
