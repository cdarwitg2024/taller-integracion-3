// ============================================================
// T16 · Edge Function: voz-pedido
// numeros.ts
// ============================================================
// Lectura de los códigos de retiro.
//
// El código es un número de 3 a 5 dígitos, no una cantidad. Leído
// dígito a dígito ("siete dos siete") es lento de descifrar en una
// cocina a full; leído como número, 727 sería "setecimientos
// veintisiete", que no es como lo pronuncia la gente del local. La
// convención es leerlo de dos en dos desde la izquierda:
//
//   727   -> "siete veintisiete"
//   1234  -> "doce treinta y cuatro"
//   12345 -> "uno veintitrés cuarenta y cinco"
//
// Con cantidad impar de dígitos el primer grupo va de uno solo, para
// que los grupos sean siempre de a dos desde la izquierda.
//
// Esto es un módulo puro a propósito: sin Deno ni dependencias, para
// poder compararlo contra el espejo del cliente
// (app-desktop/src/services/vozKdsService.js) en las pruebas.
// ============================================================

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
export function numeroHasta99(n: number): string {
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
export function agruparEnParejas(codigo: string | number): number[] {
  const digitos = String(codigo).replace(/\D/g, '');
  if (!digitos) return [];

  const grupos: number[] = [];
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
export function codigoEnPalabras(codigo: string | number): string {
  return agruparEnParejas(codigo).map((g) => numeroHasta99(g)).join(' ');
}
