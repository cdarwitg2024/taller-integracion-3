// Mock oficial de AsyncStorage: sin esto el smoke test de App.tsx no monta.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
