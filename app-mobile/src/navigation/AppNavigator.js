import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      {/* Aquí registrarás las pantallas (HomeScreen, CartScreen, WalletScreen) */}
    </NavigationContainer>
  );
}