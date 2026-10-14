'use strict';

/**
 * Maquina de estados del pedido — fuente unica para ms-pedidos.
 *
 * Es una version propia y minima, independiente de la de `backend-node`
 * (legacy). No importa nada de backend-node.
 *
 * DECISION DE NEGOCIO: agregar productos al carrito NO crea un pedido. El
 * pedido nace cuando `procesar_pago` aprueba el pago de Wallet, con
 *
 *   pedidos.pago_estado = 'pagado'    (estado del PAGO del pedido)
 *   pedidos.estado      = 'pendiente' (estado OPERATIVO del pedido)
 *   pagos.estado        = 'aprobado'  (registro del cobro en `pagos`)
 *
 * No confundir ambos conceptos: 'pagado' es el estado del pago del pedido y
 * 'aprobado' es el estado del registro en la tabla `pagos`. Ademas, 'pendiente'
 * significa "ya pagado, pendiente de preparacion" (NO pendiente de pago).
 */

// Estados operativos canonicos (son los slugs que se guardan en la columna
// `estado`; los nuevos WRITES usan unicamente estos valores).
const ESTADOS_CANONICOS = [
  'pendiente',
  'en_preparacion',
  'listo',
  'entregado',
  'cancelado'
];

// Matriz de transiciones permitidas. 'entregado' y 'cancelado' son terminales
// (sin destinos). Cancelar solo se permite desde 'pendiente'.
const MATRIZ_TRANSICIONES = {
  pendiente: ['en_preparacion', 'cancelado'],
  en_preparacion: ['listo'],
  listo: ['entregado'],
  entregado: [],
  cancelado: []
};

const ESTADO_INICIAL = 'pendiente';

// Aliases de LECTURA/COMPARACION para tolerar datos historicos escritos por
// versiones anteriores (RPC vieja con 'Pagado', backend-node con etiquetas en
// espanol, etc.). La normalizacion siempre deriva en un slug canonico.
const ALIASES = {
  pagado: 'pendiente',
  preparando: 'en_preparacion',
  'en preparación': 'en_preparacion',
  'en-preparacion': 'en_preparacion',
  retirado: 'entregado'
};

/**
 * Normaliza un estado (propio o historico) a un slug canonico, o `null` si no
 * se reconoce. Es insensible a mayusculas y espacios.
 */
function normalizarEstado(input) {
  if (!input || typeof input !== 'string') return null;
  const clave = input.trim().toLowerCase();
  if (ALIASES[clave]) return ALIASES[clave];
  if (ESTADOS_CANONICOS.includes(clave)) return clave;
  return null;
}

/**
 * Indica si se puede pasar de `de` a `a`. Normaliza ambos lados; `false` si
 * cualquiera es desconocido.
 */
function puedeTransicionar(de, a) {
  const desde = normalizarEstado(de);
  const hasta = normalizarEstado(a);
  if (!desde || !hasta) return false;
  return MATRIZ_TRANSICIONES[desde].includes(hasta);
}

/** Destinos validos desde un estado (normalizado). */
function transicionesDe(estado) {
  const canonico = normalizarEstado(estado);
  if (!canonico) return [];
  return MATRIZ_TRANSICIONES[canonico];
}

/** `true` si el estado es terminal (no admite transiciones). */
function esEstadoTerminal(estado) {
  const canonico = normalizarEstado(estado);
  return !!canonico && MATRIZ_TRANSICIONES[canonico].length === 0;
}

module.exports = {
  ESTADOS_CANONICOS,
  MATRIZ_TRANSICIONES,
  ESTADO_INICIAL,
  ALIASES,
  normalizarEstado,
  puedeTransicionar,
  transicionesDe,
  esEstadoTerminal
};
