'use strict';

/**
 * Cliente Supabase autenticado por solicitud.
 *
 * Crea un cliente con el JWT del usuario para que las RPC y las políticas RLS
 * resuelvan `auth.uid()`. No usa `service_role`, porque esa clave perdería la
 * identidad del dueño. Lo comparten los módulos de pedidos y afiliados.
 */

const { HttpError } = require('@coffeefaster/shared');
const { createClient } = require('@supabase/supabase-js');

function crearClienteAutenticado(accessToken) {
  if (!accessToken) throw new HttpError(401, 'Usuario no autenticado');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new HttpError(503, 'Configuracion de Supabase incompleta', {
      causa: 'Se requieren SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY'
    });
  }

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

module.exports = crearClienteAutenticado;
