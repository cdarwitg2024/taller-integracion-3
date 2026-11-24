module.exports = {
  moduleNameMapper: {
    // El servicio y shared deben usar la misma instancia del cliente en Jest.
    '^@supabase/supabase-js$': '<rootDir>/node_modules/@supabase/supabase-js',
  },
};
