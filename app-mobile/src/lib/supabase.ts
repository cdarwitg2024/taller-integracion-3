import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Las variables vienen de app-mobile/.env (prefijo EXPO_PUBLIC_ de Expo).
// Ese archivo NO se versiona: está en .gitignore. Si da error, copia
// .env.example -> .env.
let SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  // Fallar claro acá es mejor que dejar que cada consulta reviente sola con
  // "fetch failed" sin contexto.
  console.error(
    '[supabase] Faltan las variables de entorno.\n' +
      '  1. Creá el archivo:  app-mobile/.env   (copiá .env.example)\n' +
      '  2. Llename EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
      '  3. Reiniciá Metro:    npx expo start -c'
  );
}

// Adaptación automática para emulador Android o web:
// Si la URL apunta a localhost/127.0.0.1 y estamos en Android, usar 10.0.2.2 para alcanzar el host
if (SUPABASE_URL) {
  if (Platform.OS === 'android') {
    if (SUPABASE_URL.includes('127.0.0.1')) {
      SUPABASE_URL = SUPABASE_URL.replace('127.0.0.1', '10.0.2.2');
    } else if (SUPABASE_URL.includes('localhost')) {
      SUPABASE_URL = SUPABASE_URL.replace('localhost', '10.0.2.2');
    }
  } else if (Platform.OS === 'web') {
    if (SUPABASE_URL.includes('10.0.2.2')) {
      SUPABASE_URL = SUPABASE_URL.replace('10.0.2.2', '127.0.0.1');
    }
  }
}

export const supabase = createClient(
  SUPABASE_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:54321' : 'http://127.0.0.1:54321'),
  SUPABASE_ANON_KEY ?? 'anon-key-faltante',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
