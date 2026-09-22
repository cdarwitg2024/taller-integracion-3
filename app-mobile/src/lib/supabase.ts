import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hplsidpptpfkctreltll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbHNpZHBwdHBma2N0cmVsdGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjY1MjYsImV4cCI6MjEwNTYwMjUyNn0.B2jjLLKTjHmkJMolA7yAZo0KIAcPv7UUUfynIfqGbO0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);