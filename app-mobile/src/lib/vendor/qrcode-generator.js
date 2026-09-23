/*
 * Generador QRCode mínimo para React Native (sin dependencias nativas).
 * Reimplementa el algoritmo estándar de qrcode-generator (MIT, K. Arase)
 * recortado a lo que usa la app: byte mode, corrección de errores M,
 * versiones 1-8 (tokens cortos). API compatible:
 *   qrcode(typeNumber, errorCorrectionLevel) -> { addData, make, isDark, getModuleCount }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.qrcode = factory();
  }
}(this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // GF(256) con polinomio primitivo 0x11d (tablas exp/log).
  // ------------------------------------------------------------------
  var exp = new Array(256), log = new Array(256), _x = 1;
  for (var g = 0; g < 255; g++) { exp[g] = _x; log[_x] = g; _x <<= 1; if (_x & 0x100) _x ^= 0x11d; }
  exp[255] = exp[0];

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return exp[(log[a] + log[b]) % 255];
  }

  // ------------------------------------------------------------------
  // Tablas por versión (v1-8), nivel M.
  // Grupo de bloques RS = [cantidad, codewords totales, codewords de datos].
  // v8-M usa bloques no uniformes (2 de 38 + 2 de 39).
  // ------------------------------------------------------------------
  var RS = [
    [[1, 26, 16]], [[1, 44, 28]], [[1, 70, 44]], [[2, 50, 32]],
    [[2, 67, 43]], [[4, 43, 27]], [[4, 49, 31]], [[2, 60, 38], [2, 61, 39]],
  ];
  var ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
  ];
  var G15 = 0x537;          // generador BCH para la información de formato
  var G15_MASK = 0x5412;    // máscara de la información de formato
  var G18 = 0x1f25;         // generador BCH para el número de versión (v7+)

  function bchDigit(n) { var d = 0; while (n) { n >>>= 1; d++; } return d; }
  function bchRemainder(data, poly) {
    while (bchDigit(data) - bchDigit(poly) >= 0) {
      data ^= poly << (bchDigit(data) - bchDigit(poly));
    }
    return data;
  }
  function formatBits(mask) { return (bchRemainder(mask << 10, G15) | (mask << 10)) ^ G15_MASK; }
  function versionBits(v) { return (v << 12) | bchRemainder(v << 12, G18); }

  // ------------------------------------------------------------------
  // Codificación de datos (modo byte, contador de 8 bits válido en v1-9).
  // ------------------------------------------------------------------
  function toUtf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0xd800 || c >= 0xe000)
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  function pushBits(arr, value, count) {
    for (var i = count - 1; i >= 0; i--) arr.push((value >>> i) & 1);
  }

  function rsDataCapacity(version) {
    var cap = 0, groups = RS[version - 1];
    for (var i = 0; i < groups.length; i++) cap += groups[i][0] * groups[i][2];
    return cap;
  }

  function buildCodewords(bytes, version) {
    var cap = rsDataCapacity(version);
    var bits = [];
    pushBits(bits, 0x04, 4);      // indicador de modo byte
    pushBits(bits, bytes.length, 8);
    for (var i = 0; i < bytes.length; i++) pushBits(bits, bytes[i], 8);

    var sobrantes = cap * 8 - bits.length;
    if (sobrantes < 0) throw new Error('El contenido no cabe en el QR seleccionado.');
    var term = Math.min(4, sobrantes);
    for (var t = 0; t < term; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var pad = 0xec, p = 0;
    while (bits.length < cap * 8) {
      pushBits(bits, pad, 8);
      pad = (p = p ? 0 : 1) ? 0x11 : 0xec;
    }

    var codewords = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byte0 = 0;
      for (var k = 0; k < 8; k++) byte0 = (byte0 << 1) | bits[b + k];
      codewords.push(byte0);
    }
    return codewords;
  }

  // ------------------------------------------------------------------
  // Reed-Solomon.
  // ------------------------------------------------------------------
  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], exp[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, degree) {
    // División polinomial sobre GF(256) con arreglos de mayor a menor grado.
    var gen = rsGenerator(degree).slice().reverse(); // gen[0] = 1 (coef. líder)
    var num = data.concat(new Array(degree).fill(0));
    while (num.length > degree) {
      if (num[0] === 0) { num.shift(); continue; }
      var ratio = (log[num[0]] - log[gen[0]] + 255) % 255;
      num = num.slice(1);
      for (var j = 1; j < gen.length; j++) num[j - 1] ^= exp[(log[gen[j]] + ratio) % 255];
    }
    return num;
  }

  function interleave(codewords, version) {
    var groups = RS[version - 1];
    var dataBlocks = [], ecBlocks = [];
    var pos = 0;
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g], ecPer = grp[1] - grp[2];
      for (var b = 0; b < grp[0]; b++) {
        var slice = codewords.slice(pos, pos + grp[2]);
        pos += grp[2];
        dataBlocks.push(slice);
        ecBlocks.push(rsRemainder(slice, ecPer));
      }
    }
    var out = [];
    var ecPer = groups[0][1] - groups[0][2];
    var maxLen = dataBlocks[dataBlocks.length - 1].length;
    for (var c = 0; c < maxLen; c++) for (var i = 0; i < dataBlocks.length; i++) {
      if (c < dataBlocks[i].length) out.push(dataBlocks[i][c]);
    }
    for (var e = 0; e < ecPer; e++) for (var j = 0; j < ecBlocks.length; j++) out.push(ecBlocks[j][e]);
    return out;
  }

  // ------------------------------------------------------------------
  // Matriz + máscaras.
  // ------------------------------------------------------------------
  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i, j) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; },
    function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 === 0; },
  ];

  function makeMatrix(codewords, version, mask) {
    var qr = {};
    var size = version * 4 + 17;
    var mods = [];
    for (var r = 0; r < size; r++) mods.push(new Array(size).fill(null));
    var mf = MASKS[mask];

    function finder(row, col) {
      for (var i = -1; i <= 7; i++) {
        if (row + i < 0 || row + i >= size) continue;
        for (var j = -1; j <= 7; j++) {
          if (col + j < 0 || col + j >= size) continue;
          mods[row + i][col + j] =
            (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
            (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        }
      }
    }
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);

    var pos = ALIGN[version - 1];
    for (var a = 0; a < pos.length; a++) {
      for (var b2 = 0; b2 < pos.length; b2++) {
        var ar = pos[a], ac = pos[b2];
        if (mods[ar][ac] != null) continue;
        for (var i2 = -2; i2 <= 2; i2++) for (var j2 = -2; j2 <= 2; j2++)
          mods[ar + i2][ac + j2] = (i2 === -2 || i2 === 2 || j2 === -2 || j2 === 2 || (i2 === 0 && j2 === 0));
      }
    }

    for (var t = 8; t < size - 8; t++) {
      if (mods[t][6] == null) mods[t][6] = t % 2 === 0;
      if (mods[6][t] == null) mods[6][t] = t % 2 === 0;
    }

    if (version >= 7) {
      var vbits = versionBits(version);
      for (var v = 0; v < 18; v++) {
        var on = ((vbits >>> v) & 1) === 1;
        mods[Math.floor(v / 3)][(v % 3) + size - 11] = on;
        mods[(v % 3) + size - 11][Math.floor(v / 3)] = on;
      }
    }

    var fbits = formatBits(mask);
    for (var f = 0; f < 15; f++) {
      var bit = ((fbits >>> f) & 1) === 1;
      // copia vertical (junto al patrón de localización superior izquierdo)
      if (f < 6) mods[f][8] = bit;
      else if (f < 8) mods[f + 1][8] = bit;
      else mods[size - 15 + f][8] = bit;
      // copia horizontal
      if (f < 8) mods[8][size - f - 1] = bit;
      else if (f < 9) mods[8][15 - f] = bit;
      else mods[8][15 - f - 1] = bit;
    }
    mods[size - 8][8] = true; // módulo oscuro fijo

    // volcado de datos en zigzag (de abajo hacia arriba, de derecha a izquierda)
    var inc = -1, row = size - 1, bitIndex = 7, byteIndex = 0;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (;;) {
        for (var c = 0; c < 2; c++) {
          if (mods[row][col - c] == null) {
            var dark = byteIndex < codewords.length && ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
            if (mf(row, col - c)) dark = !dark;
            mods[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }

    qr.size = size;
    qr.mods = mods;
    return qr;
  }

  function pickVersion(bytes) {
    var dataBits = 4 + 8 + bytes.length * 8;
    for (var v = 1; v <= 8; v++) if (rsDataCapacity(v) * 8 >= dataBits) return v;
    throw new Error('Contenido demasiado largo para el QR compatible.');
  }

  // ------------------------------------------------------------------
  // API pública.
  // ------------------------------------------------------------------
  return function (typeNumber, errorCorrectionLevel) {
    var level = String(errorCorrectionLevel || 'M').toUpperCase();
    var type = typeNumber || 0;
    var bytes = null;
    var qr = null;

    var api = {
      addData: function (data) { bytes = toUtf8Bytes(String(data)); },
      make: function () {
        // Solo soporta corrección M; otras se degradan a M.
        if (level !== 'M') throw new Error('Solo se soporta nivel de corrección M.');
        bytes = bytes || [];
        var version = (type >= 1 && type <= 8) ? type : pickVersion(bytes);
        var codewords = interleave(buildCodewords(bytes, version), version);
        var bestLost = Infinity;
        for (var m = 0; m < 8; m++) {
          var cur = makeMatrix(codewords, version, m);
          var lost = penalty(cur);
          if (lost < bestLost) { bestLost = lost; qr = cur; }
        }
      },
      isDark: function (row, col) { return qr.mods[row][col] === true; },
      getModuleCount: function () { return qr.size; },
    };

    return api;
  };

  function penalty(qr) {
    var size = qr.size, mods = qr.mods, lp = 0;

    // N1: módulos consecutivos iguales (filas y columnas)
    for (var r = 0; r < size; r++) {
      var run = 1;
      for (var c = 1; c < size; c++) {
        if (mods[r][c] === mods[r][c - 1]) { run++; }
        else { if (run >= 5) lp += 3 + run - 5; run = 1; }
      }
      if (run >= 5) lp += 3 + run - 5;
    }
    for (var c0 = 0; c0 < size; c0++) {
      var runC = 1;
      for (var r0 = 1; r0 < size; r0++) {
        if (mods[r0][c0] === mods[r0 - 1][c0]) { runC++; }
        else { if (runC >= 5) lp += 3 + runC - 5; runC = 1; }
      }
      if (runC >= 5) lp += 3 + runC - 5;
    }

    // N2: bloques 2x2 del mismo color
    for (var rr = 0; rr < size - 1; rr++) for (var cc = 0; cc < size - 1; cc++) {
      var v0 = mods[rr][cc];
      if (mods[rr][cc + 1] === v0 && mods[rr + 1][cc] === v0 && mods[rr + 1][cc + 1] === v0) lp += 3;
    }

    // N3: patrón 1011101 con quiet zone
    for (var r1 = 0; r1 < size; r1++) for (var c1 = 0; c1 < size - 6; c1++) {
      if (mods[r1][c1] && !mods[r1][c1 + 1] && mods[r1][c1 + 2] && mods[r1][c1 + 3] &&
          mods[r1][c1 + 4] && !mods[r1][c1 + 5] && mods[r1][c1 + 6]) lp += 40;
    }
    for (var c2 = 0; c2 < size; c2++) for (var r2 = 0; r2 < size - 6; r2++) {
      if (mods[r2][c2] && !mods[r2 + 1][c2] && mods[r2 + 2][c2] && mods[r2 + 3][c2] &&
          mods[r2 + 4][c2] && !mods[r2 + 5][c2] && mods[r2 + 6][c2]) lp += 40;
    }

    // N4: proporción de módulos oscuros
    var dark = 0;
    for (var rd = 0; rd < size; rd++) for (var cd = 0; cd < size; cd++) if (mods[rd][cd]) dark++;
    lp += Math.floor(Math.abs((100 * dark) / (size * size) - 50) / 5) * 10;
    return lp;
  }
}));