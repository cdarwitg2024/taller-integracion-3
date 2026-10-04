import { createClient } from '@supabase/supabase-js';

// Lectura estricta y segura desde variables de entorno (.env)
// Vite expone al frontend únicamente las variables con prefijo VITE_
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
// El .env centralizado declara la clave con el naming nuevo de Supabase
// (VITE_SUPABASE_PUBLISHABLE_KEY). Se aceptan ambos nombres, igual que
// backend-node/src/config/supabase.js, para no romper si se renombra.
const supabaseAnonKey =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

// Cliente seguro para el frontend:
// - No expone claves maestras (service_role prohibido en frontend).
// - Todas las operaciones se ejecutan bajo las políticas de seguridad RLS de PostgreSQL.
// - Persistencia de sesión segura del usuario (Dueño) mediante JWT.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export default supabase;