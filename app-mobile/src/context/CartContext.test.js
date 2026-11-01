import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CartProvider, useCart } from './CartContext';

const KEY = '@coffeefast/cart';

let estado;
const Sonda = () => {
  estado = useCart();
  return null;
};

const montar = async () => {
  await act(async () => {
    TestRenderer.create(
      <CartProvider>
        <Sonda />
      </CartProvider>
    );
  });
};

describe('CartContext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    estado = undefined;
  });

  test('recupera el carrito guardado al abrir la app', async () => {
    const guardado = [{ id: 1, name: 'Café', quantity: 2 }];
    await AsyncStorage.setItem(KEY, JSON.stringify(guardado));

    await montar();

    expect(estado.hydrated).toBe(true);
    expect(estado.cart).toEqual(guardado);
  });

  test('persiste los cambios del carrito', async () => {
    await montar();

    await act(async () => {
      estado.setCart([{ id: 5, name: 'Té', quantity: 1 }]);
    });

    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual([
      { id: 5, name: 'Té', quantity: 1 },
    ]);
  });

  test('vaciar el carrito también se persiste', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 1, quantity: 1 }]));
    await montar();

    await act(async () => {
      estado.clearCart();
    });

    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual([]);
  });
});
