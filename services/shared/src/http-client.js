'use strict';

/**
 * Cliente HTTP para llamadas entre microservicios (ms-pedidos -> ms-inventario,
 * ms-pedidos -> ms-menus, etc).
 *
 * Reglas que implementa:
 *  - Timeout de 3 s por defecto. Sin AbortSignal, un ms-inventario colgado
 *    mantiene el request de ms-pedidos abierto hasta que el proxy lo corte, y
 *    se acumulan sockets hasta agotar la memoria del Pod que llama.
 *  - Cualquier fallo de red o timeout se traduce a 503. Nunca 200 con datos
 *    inventados, y nunca se reintenta solo: un reintento automatico sobre una
 *    operacion de stock puede descontar dos veces.
 *  - El 4xx del otro servicio se propaga tal cual (no es culpa de la
 *    infraestructura), el 5xx se convierte a 503.
 */

const TIMEOUT_POR_DEFECTO_MS = 3000;

class ErrorServicioRemoto extends Error {
  constructor(mensaje, opciones = {}) {
    super(mensaje);
    this.name = 'ErrorServicioRemoto';
    this.status = opciones.status || 503;
    this.servicio = opciones.servicio || null;
    this.causa = opciones.causa || null;
    if (opciones.detalle) this.detalle = opciones.detalle;
  }
}

/** Lee el cuerpo como JSON sin tirar si viene vacio o no es JSON. */
async function leerJson(res) {
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (err) {
    return texto;
  }
}

/**
 * Llama a otro microservicio.
 *
 * @param {string} url        URL absoluta, p.ej. http://ms-inventario/api/inventario/verificar
 * @param {object} [opciones]
 * @param {string} [opciones.method='GET']
 * @param {object} [opciones.body]        Se serializa a JSON.
 * @param {object} [opciones.headers]
 * @param {number} [opciones.timeoutMs=3000]
 * @param {string} [opciones.nombre]      Para los logs.
 * @returns {Promise<{status:number, data:any}>}
 */
async function llamar(url, opciones = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = TIMEOUT_POR_DEFECTO_MS,
    nombre = url
  } = opciones;

  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), timeoutMs);

  const cabeceras = { Accept: 'application/json', ...headers };
  let payload;
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    cabeceras['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, {
      method,
      headers: cabeceras,
      body: payload,
      signal: controller.signal
    });

    const data = await leerJson(res);

    if (res.ok) {
      return { status: res.status, data };
    }

    // 4xx: el otro servicio respondio con sentido (por ejemplo 409 por stock
    // insuficiente). Se propaga para que el caller pueda diferenciar.
    if (res.status >= 400 && res.status < 500) {
      throw new ErrorServicioRemoto(
        `${nombre} respondio ${res.status}`,
        { status: res.status, servicio: nombre, detalle: data }
      );
    }

    throw new ErrorServicioRemoto(`${nombre} respondio ${res.status}`, {
      status: 503,
      servicio: nombre,
      causa: 'error del servicio remoto',
      detalle: data
    });
  } catch (err) {
    if (err instanceof ErrorServicioRemoto) throw err;

    if (err.name === 'AbortError') {
      throw new ErrorServicioRemoto(
        `${nombre} no respondio en ${timeoutMs} ms`,
        { status: 503, servicio: nombre, causa: 'timeout' }
      );
    }

    throw new ErrorServicioRemoto(`${nombre} no esta disponible`, {
      status: 503,
      servicio: nombre,
      causa: err.message
    });
  } finally {
    clearTimeout(temporizador);
  }
}

/** Atajo GET. */
function get(url, opciones = {}) {
  return llamar(url, { ...opciones, method: 'GET' });
}

/** Atajo POST. */
function post(url, body, opciones = {}) {
  return llamar(url, { ...opciones, method: 'POST', body });
}

module.exports = { llamar, get, post, ErrorServicioRemoto, TIMEOUT_POR_DEFECTO_MS };