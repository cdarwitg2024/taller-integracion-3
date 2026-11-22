module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  moduleNameMapper: {
    // El servicio y shared deben usar la misma instancia del cliente en Jest.
    '^@supabase/supabase-js$': '<rootDir>/node_modules/@supabase/supabase-js',
  },
  // El service lee process.env al construir el cliente; cada test fija lo suyo.
  setupFiles: ['<rootDir>/tests/setup.js']
};
