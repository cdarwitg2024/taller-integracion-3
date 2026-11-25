import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { ApiError, apiPost } from './backendClient';

export type ComprobanteRetiro = {
  monto_clp: number; estado: 'confirmado'; referencia: string; destino: string; disponible_clp: number;
};
export type IntentoRetiro = { clave: string; monto: number; comprobante?: ComprobanteRetiro };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const almacenamiento = (usuarioId: string) => `@coffeefast/intento-retiro/${usuarioId}`;
const colas = new Map<string, Promise<unknown>>();
const envios = new Map<string, Promise<ComprobanteRetiro>>();

function enOrden<T>(usuarioId: string, accion: () => Promise<T>): Promise<T> {
  if (!usuarioId) return Promise.reject(new Error('Inicia sesión para confirmar el retiro.'));
  const siguiente = (colas.get(usuarioId) ?? Promise.resolve()).then(accion, accion);
  colas.set(usuarioId, siguiente.catch(() => {}));
  return siguiente;
}
function esComprobante(dato: any, monto: number): dato is ComprobanteRetiro {
  return dato?.estado === 'confirmado' && dato.monto_clp === monto && uuid.test(dato.referencia) &&
    typeof dato.destino === 'string' && dato.destino.trim().length > 0 &&
    Number.isSafeInteger(dato.disponible_clp) && dato.disponible_clp >= 0;
}
async function leer(usuarioId: string): Promise<IntentoRetiro | null> {
  let texto;
  try { texto = await AsyncStorage.getItem(almacenamiento(usuarioId)); }
  catch { throw new Error('No pudimos leer la solicitud guardada. Intenta nuevamente antes de confirmar otro retiro.'); }
  if (texto === null) return null;
  try {
    const dato = JSON.parse(texto);
    if (!uuid.test(dato.clave) || !Number.isSafeInteger(dato.monto) || dato.monto <= 0 ||
        (dato.comprobante !== undefined && !esComprobante(dato.comprobante, dato.monto))) throw new Error();
    return dato;
  } catch { throw new Error('No pudimos recuperar la solicitud guardada. Revisa tu historial antes de iniciar otro retiro.'); }
}
async function guardar(usuarioId: string, intento: IntentoRetiro) {
  try { await AsyncStorage.setItem(almacenamiento(usuarioId), JSON.stringify(intento)); }
  catch { throw new Error('No pudimos guardar la solicitud. Reintenta para recuperar su resultado antes de iniciar otro retiro.'); }
}
export function consultarIntentoRetiro(usuarioId: string) {
  return enOrden(usuarioId, () => leer(usuarioId));
}

// Nunca se sustituye una solicitud pendiente por otro monto o por otra clave.
export function confirmarRetiroSimulado(usuarioId: string, monto: number): Promise<ComprobanteRetiro> {
  if (envios.has(usuarioId)) return Promise.reject(new Error('Ya hay un retiro en proceso. Espera su resultado.'));
  const envio = enOrden(usuarioId, async () => {
    if (!Number.isSafeInteger(monto) || monto <= 0) throw new Error('Ingresa un monto entero mayor que cero.');
    let intento = await leer(usuarioId);
    if (intento && intento.monto !== monto) throw new Error('Recupera el retiro pendiente antes de cambiar el monto.');
    if (intento?.comprobante) return intento.comprobante;
    if (!intento) {
      intento = { clave: randomUUID(), monto };
      await guardar(usuarioId, intento); // Sin persistencia no sale ningún POST.
    }
    let dato: ComprobanteRetiro;
    try {
      dato = await apiPost<ComprobanteRetiro>('/api/afiliados/retiros', {
        monto_clp: intento.monto, clave_idempotencia: intento.clave,
      }, { usuarioId });
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 &&
          ['saldo_insuficiente', 'monto_invalido', 'clave_idempotencia_invalida'].includes(error.message)) {
        // C15 confirma el rechazo sin registrar un retiro.
        await AsyncStorage.removeItem(almacenamiento(usuarioId));
      }
      throw error;
    }
    if (!esComprobante(dato, monto)) throw new Error('No pudimos confirmar el comprobante. Recupera el retiro con la misma solicitud.');
    const comprobante: ComprobanteRetiro = { monto_clp: dato.monto_clp, estado: dato.estado,
      referencia: dato.referencia, destino: dato.destino, disponible_clp: dato.disponible_clp };
    await guardar(usuarioId, { ...intento, comprobante });
    return comprobante;
  });
  envios.set(usuarioId, envio);
  void envio.finally(() => { if (envios.get(usuarioId) === envio) envios.delete(usuarioId); }).catch(() => {});
  return envio;
}
export function prepararOtroRetiro(usuarioId: string) {
  return enOrden(usuarioId, async () => {
    const intento = await leer(usuarioId);
    if (intento && !intento.comprobante) throw new Error('Primero recupera el retiro pendiente.');
    await AsyncStorage.removeItem(almacenamiento(usuarioId));
  });
}
