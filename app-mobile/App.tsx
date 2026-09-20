import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  emoji: string;
  available: boolean;
};

type CartItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  emoji: string;
  quantity: number;
};

type Screen = 'menu' | 'cart';

const App = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [screen, setScreen] = useState<Screen>('menu');

  const addToCart = (product: Product) => {
    if (!product.available) {
      return;
    }

    setCart((currentCart: CartItem[]) => {
      const existingProduct = currentCart.find(
        (item: CartItem) => item.id === product.id
      );

      if (existingProduct) {
        return currentCart.map((item: CartItem) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          emoji: product.emoji,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (id: number) => {
    setCart((currentCart: CartItem[]) =>
      currentCart.map((item: CartItem) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  };

  const decreaseQuantity = (id: number) => {
    setCart((currentCart: CartItem[]) =>
      currentCart
        .map((item: CartItem) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item: CartItem) => item.quantity > 0)
    );
  };

  const totalProducts = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {screen === 'menu' ? (
          <MenuScreen onAddToCart={addToCart} />
        ) : (
          <CartScreen
            cart={cart}
            onIncrease={increaseQuantity}
            onDecrease={decreaseQuantity}
          />
        )}
      </View>

      <View style={styles.bottomNavigation}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('menu')}
        >
          <Text
            style={[
              styles.navIcon,
              screen === 'menu' && styles.activeNavIcon,
            ]}
          >
            ▰
          </Text>

          <Text
            style={[
              styles.navText,
              screen === 'menu' && styles.activeNavText,
            ]}
          >
            Menú
          </Text>
        </TouchableOpacity>

        <View style={styles.navItem}>
          <Text style={styles.navIcon}>▤</Text>

          <Text style={styles.navText}>
            Pedidos
          </Text>
        </View>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('cart')}
        >
          <View>
            <Text
              style={[
                styles.navIcon,
                screen === 'cart' && styles.activeNavIcon,
              ]}
            >
              ▢
            </Text>

            {totalProducts > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalProducts}
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[
              styles.navText,
              screen === 'cart' && styles.activeNavText,
            ]}
          >
            Carrito
          </Text>
        </TouchableOpacity>

        <View style={styles.navItem}>
          <Text style={styles.navIcon}>●</Text>

          <Text style={styles.navText}>
            Perfil
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },

  content: {
    flex: 1,
  },

  bottomNavigation: {
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE8E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 5,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIcon: {
    fontSize: 18,
    color: '#A39A96',
    marginBottom: 3,
  },

  activeNavIcon: {
    color: '#4A332C',
  },

  navText: {
    fontSize: 9,
    color: '#A39A96',
  },

  activeNavText: {
    color: '#4A332C',
    fontWeight: '700',
  },

  badge: {
    position: 'absolute',
    right: -8,
    top: -6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#4A332C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
});

export default App;