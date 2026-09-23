import { createClient } from '@supabase/supabase-js';

// Reemplaza con los valores de tu panel de Supabase
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);