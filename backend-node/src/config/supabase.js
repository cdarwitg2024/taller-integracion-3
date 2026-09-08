const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://yrswjmxdpmiyfpclrfmg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Advertencia: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey || 'sb_publishable_CTXjURN8DxkNYj0ULlUUYQ_M6yH3P4B'
);

module.exports = supabase;