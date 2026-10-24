module.exports = {
  // RN 0.76 publica el preset dentro del propio paquete `react-native`.
  // (El nombre `@react-native/jest-preset` existe recién desde RN 0.85.)
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    // AsyncStorage es un módulo nativo; en Jest se usa el mock oficial.
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    // @expo/vector-icons carga fuentes vía expo-font (módulo nativo). En Jest
    // se usa un mock local que renderiza el icono como texto (S2-T3).
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-safe-area-context|react-native-url-polyfill|@supabase/.*|base64-arraybuffer|utf-8|react-native-gesture-handler|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*)/',
  ],
};
