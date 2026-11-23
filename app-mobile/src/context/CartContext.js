import React, { createContext, useState, useReducer, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crearEstadoCarrito, actualizarEstadoCarrito } from './estadoCodigoCarrito';

const CART_STORAGE_KEY = '@coffeefast/cart';
let escritura = Promise.resolve();
const guardarCarrito = (cart, requiereRecotizar) => {
  const datos = JSON.stringify(requiereRecotizar ? { cart, requiereRecotizar: true } : cart);
  escritura = escritura.catch(() => {}).then(() => AsyncStorage.setItem(CART_STORAGE_KEY, datos));
  return escritura;
};

const CartContext = createContext({
  ...crearEstadoCarrito(),
  setCart: () => {},
  setCodigo: () => {},
  setRequiereRecotizar: async () => {},
  guardarCotizacion: () => {},
  clearCart: () => {},
  hydrated: false,
});

export const CartProvider = ({ children }) => {
  const [estado, dispatch] = useReducer(actualizarEstadoCarrito, undefined, crearEstadoCarrito);
  const { cart, requiereRecotizar } = estado;
  const setRequiereRecotizar = async (valor) => {
    dispatch({ tipo: 'reconfirmar', valor });
    if (valor) await guardarCarrito(cart, true);
  };
  const setCart = useCallback((valor) => dispatch({ tipo: 'carrito', valor }), []);
  const setCodigo = useCallback((valor) => dispatch({ tipo: 'codigo', valor }), []);
  const guardarCotizacion = useCallback((valor, revision) =>
    dispatch({ tipo: 'cotizacion', valor, revision }), []);
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
          const productos = Array.isArray(guardado) ? guardado : guardado?.cart;
          if (Array.isArray(productos)) {
            dispatch({ tipo: 'carrito', valor: productos, requiereRecotizar: guardado?.requiereRecotizar === true });
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
    guardarCarrito(cart, requiereRecotizar).catch((err) =>
      console.warn('[CartContext] No se pudo guardar el carrito:', err)
    );
  }, [cart, requiereRecotizar, hydrated]);

  const clearCart = useCallback(() => setCart([]), []);

  return (
    <CartContext.Provider value={{ ...estado, setCart, setCodigo, guardarCotizacion, clearCart, hydrated, setRequiereRecotizar }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
