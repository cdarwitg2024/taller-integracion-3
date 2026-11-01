module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // Los paquetes que se publican como ESM hay que transformarlos igual que
  // react-native, si no cualquier pantalla que los importe rompe en Jest.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-url-polyfill|@fortawesome)/)',
  ],
};
