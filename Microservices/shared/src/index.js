'use strict';

/**
 * Punto de entrada unico del modulo compartido.
 *
 * Expone DOS interfaces equivalentes sobre el MISMO codigo (sin duplicar
 * implementacion ni cambiar la logica de los modulos internos):
 *
 *   1) Plana (historica):
 *        const { obtenerCliente, exigirAuth, post } = require('@coffeefaster/shared');
 *
 *   2) Por namespace:
 *        const { supabase, auth, httpClient } = require('@coffeefaster/shared');
 *        supabase.obtenerCliente(...)
 *        auth.exigirAuth(...)
 *        httpClient.post(...)
 *
 * Los namespaces son exactamente los modulos reales de ./auth, ./supabase y
 * ./http-client, por lo que ambas vias entregan las mismas funciones.
 */

const supabase = require('./supabase');
const auth = require('./auth');
const httpClient = require('./http-client');

module.exports = {
  // ---------------------------------------------------------------
  // Interfaz PLANA (historica). NO se elimina nada: los servicios que
  // ya hacian `const { obtenerCliente, exigirAuth } = require(...)`
  // siguen funcionando igual.
  // ---------------------------------------------------------------
  // Cliente Supabase
  obtenerCliente: supabase.obtenerCliente,
  resetCliente: supabase.resetCliente,
  ConfigError: supabase.ConfigError,

  // Auth
  exigirAuth: auth.exigirAuth,
  authOpcional: auth.authOpcional,
  extraerToken: auth.extraerToken,
  HttpError: auth.HttpError,

  // Cliente HTTP entre servicios
  llamar: httpClient.llamar,
  get: httpClient.get,
  post: httpClient.post,
  ErrorServicioRemoto: httpClient.ErrorServicioRemoto,
  TIMEOUT_POR_DEFECTO_MS: httpClient.TIMEOUT_POR_DEFECTO_MS,

  // ---------------------------------------------------------------
  // Interfaz por NAMESPACE. Apunta a los MISMOS modulos reales: no hay
  // copias ni reimplementacion. Se cumple:
  //   shared.auth        === require('./auth')
  //   shared.supabase    === require('./supabase')
  //   shared.httpClient  === require('./http-client')
  // Asi `shared.auth.exigirAuth`, `shared.supabase.obtenerCliente` y
  // `shared.httpClient.post` son las mismas funciones que la via plana.
  // ---------------------------------------------------------------
  supabase,
  auth,
  httpClient
};