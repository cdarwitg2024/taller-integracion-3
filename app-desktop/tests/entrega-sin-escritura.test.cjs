const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

const archivo = path.resolve(__dirname, '../src/services/pedidosService.js');

function cargarServicio({ from, cambiarEstadoPedido }) {
  const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
    format: 'cjs',
    loader: 'js',
    target: 'node22',
    sourcefile: archivo
  }).code;

  const modulo = { exports: {} };
  const importar = (nombre) => {
    if (nombre === './supabaseClient') {
      return { __esModule: true, isSupabaseConfigured: true, supabase: { from } };
    }
    if (nombre === './supabase') return { supabase: { from } };
    if (nombre === './backendApi') {
      return {
        __esModule: true,
        CAFETERIA_ID: null,
        backendApi: { cambiarEstadoPedido },
        default: { cambiarEstadoPedido }
      };
    }
    if (nombre === '../utils/dateUtils') {
      return {
        parsearFecha: () => null,
        formatearHora: () => '--:--',
        formatearHoraBucket: () => null
      };
    }
    throw new Error(`Import no previsto: ${nombre}`);
  };

  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  return modulo.exports.pedidosService || modulo.exports.default;
}

test('updateEstado no permite entregar ni escribe en Supabase', async () => {
  let fromLlamado = 0;
  let backendLlamado = 0;

  const servicio = cargarServicio({
    from: () => {
      fromLlamado += 1;
      throw new Error('No debe consultar ni escribir Supabase para entregar');
    },
    cambiarEstadoPedido: async () => {
      backendLlamado += 1;
      throw new Error('No debe usar PATCH para entregar');
    }
  });

  await assert.rejects(
    () => servicio.updateEstado('1', 'entregado'),
    /solo se registra validando el QR o token/
  );
  assert.equal(fromLlamado, 0, 'No debe leer ni escribir pedidos en Supabase');
  assert.equal(backendLlamado, 0, 'No debe usar el PATCH de estado');
});

test('el servicio ya no expone la escritura alternativa de entrega', () => {
  const servicio = cargarServicio({
    from: () => { throw new Error('no usar'); },
    cambiarEstadoPedido: async () => { throw new Error('no usar'); }
  });

  assert.equal(servicio.validarQrEntrega, undefined);
  assert.equal(servicio.getByQrToken, undefined);
  assert.equal(servicio._registrarLogValidacion, undefined);
});
