import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

type IntentoCompra = { firma: string; clave: string };
const colas = new Map<string, Promise<unknown>>();
const invalidados = new Set<string>();
const almacenamiento = (usuarioId: string) => `@coffeefast/intento-compra/${usuarioId}`;

function enOrden<T>(usuarioId: string, operacion: () => Promise<T>): Promise<T> {
  const pendiente = colas.get(usuarioId) ?? Promise.resolve();
  const siguiente = pendiente.then(operacion, operacion);
  colas.set(usuarioId, siguiente);
  return siguiente;
}

export function obtenerClaveIntentoCompra(usuarioId: string, cuerpo: unknown): Promise<string> {
  if (!usuarioId) return Promise.reject(new Error('La compra requiere una cuenta activa.'));
  const firma = JSON.stringify(cuerpo);
  return enOrden(usuarioId, async () => {
    const guardado = await AsyncStorage.getItem(almacenamiento(usuarioId));
    // Una lectura dañada no permite saber si el intento anterior llegó a cobrarse.
    const anterior: IntentoCompra | null = guardado ? JSON.parse(guardado) : null;
    if (guardado && (!anterior || typeof anterior.firma !== 'string' || typeof anterior.clave !== 'string' || !anterior.clave)) {
      throw new Error('No se pudo recuperar el intento de compra. Revisa tus pedidos.');
    }
    if (!invalidados.has(usuarioId) && anterior?.firma === firma) return anterior.clave;
    const clave = randomUUID();
    await AsyncStorage.setItem(almacenamiento(usuarioId), JSON.stringify({ firma, clave }));
    invalidados.delete(usuarioId);
    return clave;
  });
}

export function reiniciarIntentoCompra(usuarioId: string): Promise<void> {
  invalidados.add(usuarioId);
  return enOrden(usuarioId, () => AsyncStorage.removeItem(almacenamiento(usuarioId)));
}
