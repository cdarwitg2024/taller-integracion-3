'use strict';

/**
 * Pruebas de la interfaz publica de @coffeefaster/shared.
 *
 * No tocan red ni base de datos: solo verifican que el modulo expone
 * correctamente las DOS interfaces (plana y por namespace) y que los
 * namespaces apuntan a los modulos reales (misma referencia), sin
 * duplicar implementacion.
 *
 * Se ejecuta con el runner nativo de Node (sin dependencias nuevas):
 *   node --test tests/index.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const shared = require('../src');
const authMod = require('../src/auth');
const supabaseMod = require('../src/supabase');
const httpMod = require('../src/http-client');

// Todo lo que la interfaz plana exportaba antes de este cambio.
const EXPORTS_PLANOS = [
  'obtenerCliente',
  'resetCliente',
  'ConfigError',
  'exigirAuth',
  'authOpcional',
  'extraerToken',
  'HttpError',
  'llamar',
  'get',
  'post',
  'ErrorServicioRemoto',
  'TIMEOUT_POR_DEFECTO_MS'
];

test('conserva TODOS los exports planos (compatibilidad)', () => {
  for (const nombre of EXPORTS_PLANOS) {
    assert.ok(nombre in shared, `falta el export plano: ${nombre}`);
  }
  assert.equal(typeof shared.obtenerCliente, 'function');
  assert.equal(typeof shared.exigirAuth, 'function');
  assert.equal(typeof shared.post, 'function');
});

test('expone los namespaces auth / supabase / httpClient', () => {
  assert.ok(shared.auth, 'falta shared.auth');
  assert.ok(shared.supabase, 'falta shared.supabase');
  assert.ok(shared.httpClient, 'falta shared.httpClient');
});

test('los namespaces apuntan a los modulos reales (misma referencia)', () => {
  assert.equal(shared.auth, authMod);
  assert.equal(shared.supabase, supabaseMod);
  assert.equal(shared.httpClient, httpMod);
});

test('ambas interfaces entregan las mismas funciones', () => {
  assert.equal(shared.auth.exigirAuth, shared.exigirAuth);
  assert.equal(shared.supabase.obtenerCliente, shared.obtenerCliente);
  assert.equal(shared.httpClient.post, shared.post);
});

test('los namespaces exponen la API esperada por los consumidores', () => {
  assert.equal(typeof shared.auth.exigirAuth, 'function');
  assert.equal(typeof shared.supabase.obtenerCliente, 'function');
  assert.equal(typeof shared.httpClient.post, 'function');
});
