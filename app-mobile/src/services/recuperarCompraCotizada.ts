import { apiPost } from './backendClient';
import { leerCompraCotizadaPendiente } from './intentoCompra';
import { clasificarPagoCotizado, type PagoCotizado } from '../utils/resultadoPago';

export async function recuperarCompraCotizada(usuarioId: string, timeoutMs: number) {
  const intento = await leerCompraCotizadaPendiente(usuarioId);
  if (!intento) return null;
  const respuesta = await apiPost<PagoCotizado | null>('/api/pedidos', intento.cuerpo, {
    timeoutMs, usuarioId, claveIdempotencia: intento.clave,
  });
  const pago = clasificarPagoCotizado(respuesta, intento.cuerpo.total_aceptado);
  return pago.tipo === 'confirmado' ? { resultado: pago.resultado, cuerpo: intento.cuerpo } : null;
}
