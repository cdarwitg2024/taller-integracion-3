// ============================================================
// T16 · probar-numeros.mjs
// ============================================================
// Comprueba la lectura de códigos de retiro por parejas, en las DOS
// copias que existen:
//
//   1. supabase/functions/voz-pedido/numeros.ts   (la que usa el servidor)
//   2. app-desktop/src/services/vozKdsService.js   (la que usa el navegador)
//
// Son copias a propósito, porque el navegador no puede leer dentro de
// supabase/functions/. El riesgo real de tenerlas duplicadas es que se
// separen y el aviso agrupado diga "727" mientras el individual diga
// "siete veintisiete". Por eso la comparación carácter por carácter es
// la parte importante de este archivo, más que la tabla de casos.
//
// Uso: node docs_local/probar-numeros.mjs
// ============================================================

import {
  numeroHasta99 as numeroCliente,
  agruparEnParejas as agruparCliente,
  codigoEnPalabras as codigoCliente,
} from '../app-desktop/src/services/vozNumeros.js';
import {
  numeroHasta99 as numeroServidor,
  agruparEnParejas as agruparServidor,
  codigoEnPalabras as codigoServidor,
} from '../supabase/functions/voz-pedido/numeros.ts';

const log = (...a) => console.log(...a);
let fallos = 0;

function comprobar(ok, descripcion, detalle = '') {
  if (ok) {
    log(`  ok   ${descripcion}`);
  } else {
    fallos++;
    log(`  FALLA ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  }
}

log('1) Números de 0 a 99');
// Los casos que importan son los que un motor de TTS suele leer mal o
// donde el español escrito no coincide con el hablado.
const hasta99 = [
  [0, 'cero'], [1, 'uno'], [7, 'siete'], [10, 'diez'], [11, 'once'],
  [13, 'trece'], [15, 'quince'], [16, 'dieciséis'], [17, 'diecisiete'],
  [19, 'diecinueve'], [20, 'veinte'], [21, 'veintiuno'], [22, 'veintidós'],
  [26, 'veintiséis'], [27, 'veintisiete'], [29, 'veintinueve'],
  [30, 'treinta'], [31, 'treinta y uno'], [34, 'treinta y cuatro'],
  [40, 'cuarenta'], [42, 'cuarenta y dos'], [45, 'cuarenta y cinco'],
  [49, 'cuarenta y nueve'], [50, 'cincuenta'], [56, 'cincuenta y seis'],
  [60, 'sesenta'], [61, 'sesenta y uno'], [70, 'setenta'], // sin "y"
  [71, 'setenta y uno'], [79, 'setenta y nueve'], // "setenta y uno", no "setenta y uno"
  [80, 'ochenta'], [87, 'ochenta y siete'], [90, 'noventa'], // sin "y"
  [91, 'noventa y uno'], [99, 'noventa y nueve'],
];

for (const [n, esperado] of hasta99) {
  comprobar(numeroCliente(n) === esperado, `${n} -> "${esperado}"`,
    `cliente dio "${numeroCliente(n)}"`);
}

log('\n2) Agrupado en parejas desde la izquierda');
const agrupados = [
  ['727', [7, 27]],       // el caso que pidió el local
  ['1234', [12, 34]],
  ['12345', [1, 23, 45]], // impar: el primer grupo va de uno solo
  ['7', [7]],
  ['70', [70]],
  ['700', [7, 0]],
  ['123456', [12, 34, 56]],
  [727, [7, 27]],         // acepta número, no solo string
];
for (const [codigo, esperado] of agrupados) {
  comprobar(
    JSON.stringify(agruparCliente(codigo)) === JSON.stringify(esperado),
    `${codigo} -> [${esperado.join(', ')}]`,
    `cliente dio [${agruparCliente(codigo).join(', ')}]`,
  );
  comprobar(
    JSON.stringify(agruparServidor(codigo)) === JSON.stringify(esperado),
    `${codigo} -> [${esperado.join(', ')}] (servidor)`,
  );
}

log('\n3) Códigos completos en palabras');
// Ojo con estos: la regla es "de dos en dos desde la izquierda", así que
// un código de 3 dígitos es 1 + 00 (no "uno cero cero") y uno de 4 es
// 10 + 00. No se agrupa por valor, sino por posición.
const frases = [
  ['727', 'siete veintisiete'],              // el ejemplo del enunciado
  ['1234', 'doce treinta y cuatro'],
  ['12345', 'uno veintitrés cuarenta y cinco'],
  ['100', 'uno cero'],           // 3 dígitos -> 1 + 00, el 00 es un solo grupo
  ['999', 'nueve noventa y nueve'],
  ['7', 'siete'],
  ['42', 'cuarenta y dos'],
  ['1000', 'diez cero'],        // 4 dígitos -> 10 + 00
  ['9999', 'noventa y nueve noventa y nueve'],
  ['10000', 'uno cero cero'],   // 5 dígitos -> 1 + 00 + 00
];
for (const [codigo, esperado] of frases) {
  comprobar(codigoCliente(codigo) === esperado, `${codigo} -> "${esperado}"`,
    `cliente dio "${codigoCliente(codigo)}"`);
}

log('\n4) La copia del navegador y la del servidor dicen lo mismo');
// Esta es la parte que justifica tener el archivo: sin esto, una de las
// dos copias podría quedar vieja sin que nadie se entere.
const todosLosCodigos = [];
for (let c = 0; c <= 999; c++) todosLosCodigos.push(c);
for (const c of [1234, 2345, 3456, 4567, 5678, 6789, 7890, 8901, 9012, 99999]) {
  todosLosCodigos.push(c);
}

const divergentes = todosLosCodigos.filter(
  (c) => codigoCliente(c) !== codigoServidor(c)
    || numeroCliente(c % 100) !== numeroServidor(c % 100)
    || JSON.stringify(agruparCliente(c)) !== JSON.stringify(agruparServidor(c)),
);

comprobar(
  divergentes.length === 0,
  `${todosLosCodigos.length} códigos: cliente y servidor idénticos`,
  divergentes.length
    ? `difieren en ${divergentes.slice(0, 5).join(', ')}`
    : '',
);

log('\n5) Entradas raras no rompen nada');
// Un código viene de la base; si llega vacío o con basura, el aviso tiene
// que seguir saliendo ("Nueva comanda entrante"), no romperse.
for (const raro of [null, undefined, '', 'abc', 0, -5, NaN, '12a34', {}]) {
  const salida = codigoCliente(raro);
  comprobar(typeof salida === 'string', `${JSON.stringify(raro)} no rompe (devuelve texto)`,
    `devolvió ${typeof salida}`);
}

log('');
if (fallos === 0) {
  log('NÚMEROS OK');
} else {
  log(`${fallos} FALLO(S)`);
  process.exitCode = 1;
}
