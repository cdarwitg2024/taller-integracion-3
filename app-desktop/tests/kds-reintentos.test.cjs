// Prueba el reintento de lectura de detalles del canal KDS ante una inserción reciente.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

// Carga kdsRealtime con un supabase ficticio y un normalizador que registra su entrada.
function cargarKds(respuestasDetalles) {
  const archivo = path.resolve(__dirname, '../src/services/kdsRealtime.js');
  const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
    format: 'cjs', loader: 'js', target: 'node22', sourcefile: archivo,
  }).code;
  const consultas = [];
  const entradas = [];
  const comandas = [];
  const callbacks = {};
  const supabase = {
    channel() {
      return {
        on(_tipo, filtro, callback) { callbacks[filtro.event] = callback; return this; },
        subscribe() { return this; },
        unsubscribe() {},
      };
    },
    removeChannel() {},
    from(tabla) {
      consultas.push(tabla);
      if (tabla === 'cafeterias') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
      }
      return { select: () => ({ eq: async () => respuestasDetalles.shift() }) };
    },
  };
  const normalizarPedido = fila => {
    entradas.push(fila);
    return { ...fila, normalizado: true };
  };
  const modulo = { exports: {} };
  const importar = nombre => {
    if (nombre === './supabaseClient.js') return { supabase, isSupabaseConfigured: true };
    if (nombre === './pedidosService') return { normalizarPedido };
    throw new Error('Import no definido: ' + nombre);
  };
  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  modulo.exports.kdsRealtime.suscribir({ cafeteriaId: 7, onComanda: comanda => comandas.push(comanda) });
  return { consultas, entradas, comandas, callbacks };
}

test('KDS reintenta los detalles y normaliza el pedido con los datos recuperados', async () => {
  const detalle = { id: 5, producto_id: 3, nombre: 'Café', precio_unitario: 2500, cantidad: 1, productos: { nombre: 'Café' } };
  const h = cargarKds([{ data: [], error: null }, { data: [detalle], error: null }]);
  await h.callbacks.INSERT({ new: { id: 41, cafeteria_id: 7, estado: 'pendiente' } });

  assert.deepEqual(h.consultas.filter(tabla => tabla === 'detalles_pedido'), ['detalles_pedido', 'detalles_pedido']);
  assert.equal(h.entradas.length, 1);
  assert.deepEqual(h.entradas[0].detalles_pedido, [detalle]);
  assert.equal(h.comandas.length, 1);
  assert.equal(h.comandas[0].normalizado, true);
  assert.deepEqual(h.comandas[0].detalles_pedido, [detalle]);
});

test('KDS conserva la normalización aunque el reintento también falle', async () => {
  const h = cargarKds([
    { data: null, error: new Error('sin_detalles') },
    { data: null, error: new Error('sin_detalles') },
  ]);
  await h.callbacks.INSERT({ new: { id: 42, cafeteria_id: 7, estado: 'pendiente' } });

  assert.deepEqual(h.entradas[0].detalles_pedido, []);
  assert.equal(h.comandas.length, 1);
  assert.equal(h.comandas[0].normalizado, true);
});
