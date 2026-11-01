// Mock oficial de AsyncStorage: sin esto los tests que montan pantallas no
// arrancan (App.tsx y CartContext persisten el carrito ahí).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
