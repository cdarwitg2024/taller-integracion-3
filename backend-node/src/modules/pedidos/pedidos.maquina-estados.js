const ESTADOS = ['Creado', 'Pagado', 'En preparación', 'Listo', 'Retirado', 'Cancelado'];

const MATRIZ = {
  'Creado': ['Pagado'],
  'Pagado': ['En preparación', 'Cancelado'],
  'En preparación': ['Listo'],
  'Listo': ['Retirado', 'Cancelado'],
  'Retirado': [],
  'Cancelado': []
};

const ESTADO_INICIAL = 'Pagado';

const ALIASES = {
  'creado': 'Creado',
  'pagado': 'Pagado',
  'pendiente': 'Pagado',
  'en_preparacion': 'En preparación',
  'en-preparacion': 'En preparación',
  'en preparación': 'En preparación',
  'preparando': 'En preparación',
  'listo': 'Listo',
  'entregado': 'Retirado',
  'retirado': 'Retirado',
  'cancelado': 'Cancelado'
};

function normalizarEstado(input) {
  if (!input || typeof input !== 'string') return null;
  const clave = input.trim().toLowerCase();
  if (ALIASES[clave]) return ALIASES[clave];
  const directo = ESTADOS.find(s => s.toLowerCase() === clave);
  return directo || null;
}

function puedeTransicionar(de, a) {
  const desde = normalizarEstado(de);
  const hasta = normalizarEstado(a);
  if (!desde || !hasta) return false;
  return MATRIZ[desde].includes(hasta);
}

function transicionesDe(estado) {
  const canonico = normalizarEstado(estado);
  if (!canonico) return [];
  return MATRIZ[canonico];
}

// Traduccion de las etiquetas legibles de la maquina de estados a los slugs
// que guarda la columna `estado` en la base de datos. El movil y el KDS
// comparan contra estos valores en minusculas; guardar la etiqueta dejaba los
// pedidos pagados y entregados fuera de las columnas del KDS.
const ESTADO_DB = {
  Creado: 'pendiente',
  Pagado: 'pendiente',
  'En preparación': 'en_preparacion',
  Listo: 'listo',
  Retirado: 'entregado',
  Cancelado: 'cancelado'
};

// Traduccion inversa: slug de la BD -> etiqueta publica de la API.
const ETIQUETA_ESTADO = {
  pendiente: 'Pagado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Retirado',
  cancelado: 'Cancelado'
};

function esEstadoTerminal(estado) {
  const canonico = normalizarEstado(estado);
  return !!canonico && MATRIZ[canonico].length === 0;
}

module.exports = {
  ESTADOS,
  MATRIZ,
  ESTADO_INICIAL,
  ESTADO_DB,
  ETIQUETA_ESTADO,
  normalizarEstado,
  puedeTransicionar,
  transicionesDe,
  esEstadoTerminal
};
