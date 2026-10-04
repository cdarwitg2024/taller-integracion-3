import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_STORAGE_KEY = '@coffeefast/cart';

const CartContext = createContext({
  cart: [],
  setCart: () => {},
  clearCart: () => {},
  hydrated: false,
});

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  // `hydrated` evita pintar un carrito vacío antes de terminar de leer
  // AsyncStorage: sin él, el primer render siempre mostraba el carrito vacío
  // y pisaba lo guardado en disco.
  const [hydrated, setHydrated] = useState(false);

  // Carga inicial: recuperar el carrito guardado (si existe)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const crudo = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (!cancelado && crudo) {
          const guardado = JSON.parse(crudo);
          if (Array.isArray(guardado)) {
            setCart(guardado);
          }
        }
      } catch (err) {
        console.warn('[CartContext] No se pudo recuperar el carrito:', err);
      } finally {
        if (!cancelado) setHydrated(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Persistir cada cambio, pero SOLO después de hidratar, para no pisar lo
  // guardado con el estado inicial vacío.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)).catch((err) =>
      console.warn('[CartContext] No se pudo guardar el carrito:', err)
    );
  }, [cart, hydrated]);

  const clearCart = useCallback(() => setCart([]), []);

  return (
    <CartContext.Provider value={{ cart, setCart, clearCart, hydrated }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
