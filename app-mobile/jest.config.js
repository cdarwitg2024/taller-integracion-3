module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // react-native-url-polyfill se publica como ESM: hay que transformarlo igual
  // que react-native, si no App.test.tsx falla al importar src/lib/supabase.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-url-polyfill|@fortawesome/react-native-fontawesome)/)',
  ],
};
