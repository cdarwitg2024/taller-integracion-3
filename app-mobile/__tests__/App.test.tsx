/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { LoginScreen } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// El límite externo es la sesión de Auth; App y las pantallas son reales.
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

test('sin sesión muestra login y permite abrir el registro', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree.root.findAllByType(LoginScreen)).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    tree.root.findByType(LoginScreen).props.onNavigateToRegister();
  });
  expect(tree.root.findAllByType(LoginScreen)).toHaveLength(0);
  expect(tree.root.findAllByType(RegisterScreen)).toHaveLength(1);
  await ReactTestRenderer.act(async () => tree.unmount());
});
