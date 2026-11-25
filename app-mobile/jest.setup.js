// Mock oficial de AsyncStorage: sin esto los tests que montan pantallas no
// arrancan (App.tsx y CartContext persisten el carrito ahí).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Las pruebas de componentes controlan la respuesta del portapapeles nativo.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

// expo-crypto usa un módulo nativo; UUID deterministas y distintos para Jest.
jest.mock('expo-crypto', () => {
  let secuencia = 0;
  return { randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`) };
});
