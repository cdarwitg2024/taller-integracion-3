import { supabase } from '../lib/supabase';

/**
 * Cliente HTTP del backend de CoffeeFast.
 *
 * Por qué existe: hasta ahora el checkout llamaba directo a la RPC
 * `procesar_pago` desde la app, saltándose el backend. La creación del pedido
 * ahora pasa por `POST /api/pedidos`, que:
 *
 *   1. valida el usuario (JWT),
 *   2. pide los precios a ms-menus /api/menus/precios (precios autoritativos),
 *   3. ejecuta `procesar_pago` en Supabase.
 *
 * Reglas del cliente:
 *  - La URL sale de `EXPO_PUBLIC_API_URL` y se le quita el "/" final.
 *  - El JWT se toma de la sesión actual de Supabase (`session.access_token`).
 *  - NUNCA lleva service keys: la app solo puede actuar como el usuario.
 *  - NUNCA imprime el token.
 *  - NUNCA desactiva la validación TLS: si el certificado no valida, el
 *    error se reporta tal cual; no se parchea el handshake.
 */

/** Error claro del lado cliente: configuración, sesión o respuesta HTTP. */
export class ApiError extends Error {
  /** HTTP 0 cuando el fallo es de red o de configuración. */
  readonly status: number;
  /** `detalle` del cuerpo de error del backend (solo se envía en errores 4xx). */
  readonly detalle?: string;

  constructor(mensaje: string, status = 0, detalle?: string) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.detalle = detalle;
    // Sin esto, `e instanceof ApiError` puede fallar si el transpilador baja
    // las clases a funciones heredadas de Error. La app depende de esa
    // comprobación para elegir el mensaje que se muestra.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * URL base del backend, sin "/" final.
 *
 * PedidosScreen.js usa la misma convención (`.replace(/\/$/, '')`); acá se
 * quitan todas las barras finales para que `https://host` y
 * `https://host/api/` produzcan la misma URL base.
 */
function urlBase(): string {
  const cruda = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  const base = cruda.replace(/\/+$/, '');

  if (!base) {
    throw new ApiError(
      'Falta EXPO_PUBLIC_API_URL: completá app-mobile/.env con la URL del backend ' +
        '(copiá .env.example) y reiniciá Metro con `npx expo start -c`.'
    );
  }

  return base;
}

/** `api/pedidos` -> `/api/pedidos`, para que un path sin "/" inicial no trunque la URL. */
function normalizarRuta(ruta: string): string {
  const limpia = (ruta ?? '').trim();
  if (!limpia) {
    throw new ApiError('apiPost: la ruta no puede estar vacía.');
  }
  return limpia.startsWith('/') ? limpia : `/${limpia}`;
}

/** JWT de la sesión activa. Sin sesión no hay cabecera Authorization posible. */
async function tokenActual(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new ApiError(`No se pudo leer la sesión de Supabase: ${error.message}`);
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new ApiError('No hay sesión activa: iniciá sesión para continuar.');
  }

  return token;
}

/** Cuerpo JSON, o `undefined` si la respuesta no traía JSON (HTML de proxy, cuerpo vacío, etc.). */
function cuerpoJson(texto: string): unknown {
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/**
 * Mensaje del backend para errores.
 *
 * ms-pedidos responde `{ error, servicio, detalle? }` (ver
 * Microservices/ms-pedidos/src/app.js); un 404 de ruta es del gateway. Si el
 * cuerpo no es JSON, queda `undefined` y se usa el mensaje HTTP genérico.
 */
function mensajeDeError(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const cuerpo = json as Record<string, unknown>;
  if (typeof cuerpo.error === 'string') return cuerpo.error;
  if (typeof cuerpo.mensaje === 'string') return cuerpo.mensaje;
  return undefined;
}

function detalleDeError(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const cuerpo = json as Record<string, unknown>;
  return typeof cuerpo.detalle === 'string' ? cuerpo.detalle : undefined;
}

function textoDe(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

/**
 * `POST` genérico contra el backend.
 *
 * Devuelve el cuerpo JSON ya parseado y lanza `ApiError` cuando:
 *  - falta `EXPO_PUBLIC_API_URL`;
 *  - no hay sesión (ni por consiguiente token);
 *  - falla la red;
 *  - la respuesta HTTP no es 2xx (con el `error` del backend si existe).
 *
 * @param ruta  ruta relativa, p. ej. `/api/pedidos`.
 * @param cuerpo objeto serializado con `JSON.stringify` como body.
 */
export async function apiPost<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const url = `${urlBase()}${normalizarRuta(ruta)}`;
  const token = await tokenActual();

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Sin `no-validate` ni equivalentes: TLS queda tal cual lo resuelve el
      // sistema. Tampoco se manda ningún header de key del lado del cliente.
      body: JSON.stringify(cuerpo ?? {}),
    });
  } catch (e) {
    // Red, DNS o handshake TLS roto: nunca se incluye el token en el mensaje.
    throw new ApiError(`No se pudo contactar con el backend (${ruta}): ${textoDe(e)}`);
  }

  const texto = await respuesta.text().catch(() => '');
  const json = cuerpoJson(texto);

  if (!respuesta.ok) {
    throw new ApiError(
      mensajeDeError(json) ?? `El backend respondió HTTP ${respuesta.status} en ${ruta}.`,
      respuesta.status,
      detalleDeError(json)
    );
  }

  return json as T;
}

/**
 * `GET` autenticado contra el backend (S2-T14).
 *
 * Utiliza el JWT de la sesión activa de Supabase Auth en `Authorization: Bearer <token>`.
 * Retorna el cuerpo JSON tipado y lanza `ApiError` con el código HTTP correspondiente
 * (401 No autenticado, 404 No encontrado / rol no autorizado, 409 Estado no disponible)
 * o status 0 ante fallos de red / timeout.
 *
 * @param ruta ruta relativa, p. ej. `/api/pedidos/123/qr`.
 * @param opciones configuración opcional, como `timeoutMs`.
 */
export async function apiGet<T>(ruta: string, opciones?: { timeoutMs?: number }): Promise<T> {
  const url = `${urlBase()}${normalizarRuta(ruta)}`;
  const token = await tokenActual();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opciones?.timeoutMs ?? 6000);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError(`Tiempo de espera agotado al consultar el backend (${ruta}).`, 0);
    }
    throw new ApiError(`No se pudo contactar con el backend (${ruta}): ${textoDe(e)}`, 0);
  } finally {
    clearTimeout(timer);
  }

  const texto = await respuesta.text().catch(() => '');
  const json = cuerpoJson(texto);

  if (!respuesta.ok) {
    throw new ApiError(
      mensajeDeError(json) ?? `El backend respondió HTTP ${respuesta.status} en ${ruta}.`,
      respuesta.status,
      detalleDeError(json)
    );
  }

  return json as T;
}
