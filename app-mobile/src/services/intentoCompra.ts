import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

type CuerpoCompra = Record<string, unknown> & { franja_retiro: string };
type IntentoGuardado = { firma: string; clave: string; pendiente?: boolean };
type IntentoCompra<T> = { cuerpo: T; clave: string };
const colas = new Map<string, Promise<unknown>>();
const almacenamiento = (usuarioId: string) => `@coffeefast/intento-compra/${usuarioId}`;

export class ErrorIntentoCompra extends Error {
  constructor(public codigo: 'registro_danado' | 'almacenamiento', mensaje: string) {
    super(mensaje);
    this.name = 'ErrorIntentoCompra';
    Object.setPrototypeOf(this, ErrorIntentoCompra.prototype);
  }
}

function enOrden<T>(usuarioId: string, operacion: () => Promise<T>): Promise<T> {
  const pendiente = colas.get(usuarioId) ?? Promise.resolve();
  const siguiente = pendiente.then(operacion, operacion);
  colas.set(usuarioId, siguiente);
  return siguiente;
}

function confirmacion(cuerpo: CuerpoCompra): string {
  const { franja_retiro, ...datos } = cuerpo;
  return JSON.stringify(datos);
}

async function leerIntento(usuarioId: string): Promise<IntentoGuardado | null> {
  let texto: string | null;
  try { texto = await AsyncStorage.getItem(almacenamiento(usuarioId)); }
  catch { throw new ErrorIntentoCompra('almacenamiento', 'No se pudo leer el intento local. Revisa tus pedidos antes de volver a pagar.'); }
  if (texto === null) return null;
  try {
    const registro = JSON.parse(texto);
    if (registro?.invalidado === true) return null;
    const cuerpo = JSON.parse(registro.firma);
    if (!registro.clave || typeof registro.clave !== 'string' || !cuerpo || typeof cuerpo.franja_retiro !== 'string') throw new Error();
    return registro;
  } catch {
    throw new ErrorIntentoCompra('registro_danado', 'No se pudo recuperar el intento local. Revisa tus pedidos y reinicia el intento para desbloquear una compra nueva.');
  }
}

async function guardar(usuarioId: string, registro: unknown): Promise<void> {
  try { await AsyncStorage.setItem(almacenamiento(usuarioId), JSON.stringify(registro)); }
  catch { throw new ErrorIntentoCompra('almacenamiento', 'No se pudo guardar el estado local de la compra. Revisa tus pedidos y reintenta el reinicio antes de iniciar otra compra.'); }
}

export function consultarIntentoPendiente(usuarioId: string): Promise<boolean> {
  return enOrden(usuarioId, async () => {
    const intento = await leerIntento(usuarioId);
    // Los registros anteriores a este estado también pudieron enviarse.
    return intento !== null && intento.pendiente !== false;
  });
}

export function obtenerIntentoCompra<T extends CuerpoCompra>(usuarioId: string, cuerpo: T): Promise<IntentoCompra<T>> {
  if (!usuarioId) return Promise.reject(new Error('La compra requiere una cuenta activa.'));
  const firma = JSON.stringify(cuerpo);
  return enOrden(usuarioId, async () => {
    const anterior = await leerIntento(usuarioId);
    // La firma contiene el cuerpo original; también recupera los registros previos de D07.
    const original: T | null = anterior ? JSON.parse(anterior.firma) : null;
    if (anterior && original && confirmacion(original) === confirmacion(cuerpo)) {
      return { clave: anterior.clave, cuerpo: original };
    }
    const clave = randomUUID();
    await guardar(usuarioId, { firma, clave, pendiente: false });
    return { clave, cuerpo: JSON.parse(firma) as T };
  });
}

export function reiniciarIntentoCompra(usuarioId: string, conservarPendiente = false): Promise<void> {
  return enOrden(usuarioId, async () => {
    if (conservarPendiente) {
      const intento = await leerIntento(usuarioId);
      if (intento?.pendiente !== false) return;
    }
    await guardar(usuarioId, { invalidado: true });
  });
}

export function marcarIntentoEnviado(usuarioId: string, clave: string): Promise<void> {
  return enOrden(usuarioId, async () => {
    const intento = await leerIntento(usuarioId);
    if (!intento || intento.clave !== clave) throw new ErrorIntentoCompra('almacenamiento', 'El intento cambió antes del envío. Revisa tus pedidos e inicia otra confirmación.');
    await guardar(usuarioId, { ...intento, pendiente: true });
  });
}
