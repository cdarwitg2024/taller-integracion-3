'use strict';

// Valores por defecto para los tests. Los tests mockean `obtenerCliente`, asi
// que estos valores no llegan a usarse contra Supabase: solo evitan que una
// lectura accidental de process.env sin variable rompa el modulo compartido.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'clave-de-pruebas-no-valida';
process.env.NODE_ENV = 'test';