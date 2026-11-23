import { ApiError, apiPost } from './backendClient';
import { leerCompraCotizadaPendiente } from './intentoCompra';
import { clasificarPagoCotizado, clasificarRechazoPagoCotizado, type PagoCotizado } from '../utils/resultadoPago';

export async function recuperarCompraCotizada(usuarioId: string, timeoutMs: number) {
  const intento = await leerCompraCotizadaPendiente(usuarioId);
  if (!intento) return null;
  try {
    const respuesta = await apiPost<PagoCotizado | null>('/api/pedidos', intento.cuerpo, {
      timeoutMs, usuarioId, claveIdempotencia: intento.clave,
    });
    const pago = clasificarPagoCotizado(respuesta, intento.cuerpo.total_aceptado);
    return pago.tipo === 'confirmado'
      ? { tipo: 'confirmado' as const, resultado: pago.resultado, cuerpo: intento.cuerpo } : null;
  } catch (error) {
    const rechazo = error instanceof ApiError ? clasificarRechazoPagoCotizado(error) : null;
    if (rechazo) return { tipo: rechazo } as const;
    throw error;
  }
}
