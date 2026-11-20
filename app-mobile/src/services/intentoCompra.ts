import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

type CuerpoCompra = Record<string, unknown> & { franja_retiro: string };
type IntentoGuardado = { firma: string; clave: string };
type IntentoCompra<T> = { cuerpo: T; clave: string };
const colas = new Map<string, Promise<unknown>>();
const invalidados = new Set<string>();
const almacenamiento = (usuarioId: string) => `@coffeefast/intento-compra/${usuarioId}`;

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

export function obtenerIntentoCompra<T extends CuerpoCompra>(usuarioId: string, cuerpo: T): Promise<IntentoCompra<T>> {
  if (!usuarioId) return Promise.reject(new Error('La compra requiere una cuenta activa.'));
  const firma = JSON.stringify(cuerpo);
  return enOrden(usuarioId, async () => {
    const guardado = await AsyncStorage.getItem(almacenamiento(usuarioId));
    // Una lectura dañada no permite saber si el intento anterior llegó a cobrarse.
    const anterior: IntentoGuardado | null = guardado ? JSON.parse(guardado) : null;
    if (guardado && (!anterior || typeof anterior.firma !== 'string' || typeof anterior.clave !== 'string' || !anterior.clave)) {
      throw new Error('No se pudo recuperar el intento de compra. Revisa tus pedidos.');
    }
    // La firma contiene el cuerpo original; también recupera los registros previos de D07.
    const original: T | null = anterior ? JSON.parse(anterior.firma) : null;
    if (anterior && (!original || typeof original.franja_retiro !== 'string')) {
      throw new Error('No se pudo recuperar el cuerpo del intento. Revisa tus pedidos.');
    }
    if (!invalidados.has(usuarioId) && anterior && original && confirmacion(original) === confirmacion(cuerpo)) {
      return { clave: anterior.clave, cuerpo: original };
    }
    const clave = randomUUID();
    await AsyncStorage.setItem(almacenamiento(usuarioId), JSON.stringify({ firma, clave }));
    invalidados.delete(usuarioId);
    return { clave, cuerpo: JSON.parse(firma) as T };
  });
}

export function reiniciarIntentoCompra(usuarioId: string): Promise<void> {
  invalidados.add(usuarioId);
  return enOrden(usuarioId, () => AsyncStorage.removeItem(almacenamiento(usuarioId)));
}
