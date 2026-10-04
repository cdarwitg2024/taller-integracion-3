// ------------------------------------------------------------
// Códigos de retiro leídos por parejas.
// ------------------------------------------------------------
// Espejo exacto de supabase/functions/voz-pedido/numeros.ts. Tiene que
// ser copia y no import: el navegador no puede leer dentro de
// supabase/functions/, y si las dos versiones se separan el aviso
// agrupado (que se arma acá) diría "727" mientras que el individual
// (que se arma en el servidor) diría "siete veintisiete".
//
//   727   -> "siete veintisiete"
//   1234  -> "doce treinta y cuatro"
//   12345 -> "uno veintitrés cuarenta y cinco"
//
// docs_local/probar-numeros.mjs compara las dos copias carácter por
// carácter, así que una desincronización sale a la luz.
//
const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro',
  'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce',
  'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
];

// 20 a 29 son "veinti-", no "veinte y uno".
const ESPECIALES_20_A_29 = [
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
  'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const DECENAS = [
  '', '', 'veinte', 'treinta', 'cuarenta',
  'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa',
];

/** 0 a 99 en palabras. 16 -> "dieciséis", 21 -> "veintiuno", 34 -> "treinta y cuatro" */
export function numeroHasta99(n) {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 0 || v > 99) return '';
  if (v < 20) return UNIDADES[v];
  if (v < 30) return ESPECIALES_20_A_29[v - 20];

  const decena = Math.floor(v / 10);
  const unidad = v % 10;
  // Las decenas redondas no llevan unidad: "cuarenta", no "cuarenta y cero".
  if (unidad === 0) return DECENAS[decena];
  return `${DECENAS[decena]} y ${UNIDADES[unidad]}`;
}

/** Divide un código en grupos de dos desde la izquierda. 12345 -> [1, 23, 45] */
export function agruparEnParejas(codigo) {
  const digitos = String(codigo).replace(/\D/g, '');
  if (!digitos) return [];

  const grupos = [];
  let i = 0;
  // Si sobran un dígito al final, el primer grupo es de uno solo.
  if (digitos.length % 2 === 1) {
    grupos.push(Number(digitos[0]));
    i = 1;
  }

  for (; i < digitos.length; i += 2) {
    grupos.push(Number(digitos.slice(i, i + 2)));
  }
  return grupos;
}

/** "727" -> "siete veintisiete" */
export function codigoEnPalabras(codigo) {
  return agruparEnParejas(codigo).map((g) => numeroHasta99(g)).join(' ');
}
