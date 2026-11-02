module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  // El service lee process.env al construir el cliente; cada test fija lo suyo.
  setupFiles: ['<rootDir>/tests/setup.js']
};