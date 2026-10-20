'use strict';

/**
 * Cliente Supabase compartido.
 *
 * Decisiones:
 *  - Se crea UNA vez por proceso (require cache) porque createClient abre un
 *    pool de conexiones; crear uno por request agota el socket del Pod.
 *  - Sin fallback a datos en memoria: si Supabase no responde, el error sube y
 *    el service responde 503. Un mock oculto una base caida.
 *  - `autoRefreshToken` apagado en servidor: nadie refresca nada, y el refresh
 *    es un evento por usuario que aqui solo genera ruido en los logs.
 */

const { createClient } = require('@supabase/supabase-js');

let cliente = null;

function obtenerCliente() {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
// Acepta las claves utilizadas por los distintos microservicios.
// Para validar sesiones con auth.getUser(token), la publishable key es suficiente.
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new ConfigError('Falta SUPABASE_URL en el entorno');
  }
  if (!key) {
    throw new ConfigError(
      'Falta la clave de Supabase: define SUPABASE_SERVICE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_KEY o SUPABASE_ANON_KEY'
    );
  }

  cliente = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'coffeefaster-ms' } }
  });

  return cliente;
}

class ConfigError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ConfigError';
    this.esDeConfiguracion = true;
  }
}

/**
 * Resetea el cliente cacheado. Solo para tests.
 */
function resetCliente() {
  cliente = null;
}

module.exports = { obtenerCliente, resetCliente, ConfigError };