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

function esEstadoTerminal(estado) {
  const canonico = normalizarEstado(estado);
  return !!canonico && MATRIZ[canonico].length === 0;
}

module.exports = {
  ESTADOS,
  MATRIZ,
  ESTADO_INICIAL,
  normalizarEstado,
  puedeTransicionar,
  transicionesDe,
  esEstadoTerminal
};