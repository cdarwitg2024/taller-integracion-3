import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yrswjmxdpmiyfpclrfmg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CTXjURN8DxkNYj0ULlUUYQ_M6yH3P4B';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});