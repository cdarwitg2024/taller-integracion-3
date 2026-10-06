'use strict';

/**
 * Punto de entrada unico del modulo compartido.
 *
 * En un servicio se usa asi:
 *   const { obtenerCliente, exigirAuth } = require('@coffeefaster/shared');
 */

const supabase = require('./supabase');
const auth = require('./auth');
const httpClient = require('./http-client');

module.exports = {
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
  TIMEOUT_POR_DEFECTO_MS: httpClient.TIMEOUT_POR_DEFECTO_MS
};