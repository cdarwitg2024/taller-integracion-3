module.exports = {
  // RN 0.76 publica el preset dentro del propio paquete `react-native`.
  // (El nombre `@react-native/jest-preset` existe recién desde RN 0.85.)
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    // AsyncStorage es un módulo nativo; en Jest se usa el mock oficial.
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-safe-area-context|react-native-url-polyfill|@supabase/.*|base64-arraybuffer|utf-8|react-native-gesture-handler|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*)/',
  ],
};
