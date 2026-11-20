module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // Expo sustituye EXPO_PUBLIC_* al compilar para la app. En Jest las conserva
  // para probar el cliente HTTP con variables sintéticas y sin depender del .env.
  transform: {
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { caller: { preserveEnvVars: true } }],
  },
  // react-native-url-polyfill se publica como ESM: hay que transformarlo igual
  // que react-native, si no App.test.tsx falla al importar src/lib/supabase.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-url-polyfill|@fortawesome/react-native-fontawesome)/)',
  ],
};
