import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import CartItem from '../components/CartItem';

const initialCart = [
  {
    id: 1,
    name: 'Café Latte Vainilla',
    description: 'Grande • Leche descremada',
    price: 2400,
    quantity: 1,
    emoji: '☕',
  },
  {
    id: 2,
    name: 'Sándwich Ave Palta',
    description: 'Pan rústico integral',
    price: 3600,
    quantity: 1,
    emoji: '🥪',
  },
  {
    id: 3,
    name: 'Muffin de Arándanos',
    description: 'Recién horneado',
    price: 1800,
    quantity: 1,
    emoji: '🧁',
  },
];

const CartScreen = () => {
  const [cart, setCart] = useState(initialCart);

  const increaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const totalProducts = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Tu Pedido</Text>

        <View style={styles.headerIcon}>
          <Text>▣</Text>
        </View>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* Punto de retiro */}
            <View style={styles.pickupCard}>
              <View style={styles.locationCircle}>
                <Text>●</Text>
              </View>

              <View style={styles.pickupInfo}>
                <Text style={styles.pickupLabel}>
                  PUNTO DE RETIRO
                </Text>

                <Text style={styles.pickupName}>
                  Cafetería Central
                </Text>
              </View>

              <View style={styles.campusBadge}>
                <Text style={styles.campusText}>• UCT</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onIncrease={increaseQuantity}
            onDecrease={decreaseQuantity}
          />
        )}
        ListFooterComponent={
          <>
            {/* Tiempo de preparación */}
            <View style={styles.readyCard}>
              <Text style={styles.bolt}>ϟ</Text>

              <View>
                <Text style={styles.readyTitle}>
                  Listo en 6 - 8 minutos
                </Text>

                <Text style={styles.readyDescription}>
                  Sin espera en caja al retirar
                </Text>
              </View>
            </View>

            {/* Resumen */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.subtotalLabel}>
                  Subtotal ({totalProducts} productos)
                </Text>

                <Text style={styles.subtotal}>
                  ${total.toLocaleString('es-CL')}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>
                    Total a Pagar
                  </Text>

                  <Text style={styles.iva}>
                    IVA incluido
                  </Text>
                </View>

                <Text style={styles.total}>
                  ${total.toLocaleString('es-CL')}
                </Text>
              </View>
            </View>

            {/* Botón */}
            <TouchableOpacity style={styles.paymentButton}>
              <Text style={styles.paymentText}>
                Proceder al Pago
              </Text>

              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              Retiro sin filas en Barra de Cafetería Central • Campus UCT
            </Text>
          </>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },

  header: {
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  backButton: {
    width: 35,
    height: 35,
    justifyContent: 'center',
  },

  backText: {
    fontSize: 32,
    color: '#4A332C',
    lineHeight: 32,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A332C',
  },

  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: '#4A332C',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerIconText: {
    color: '#FFFFFF',
  },

  list: {
    padding: 16,
    paddingBottom: 25,
  },

  pickupCard: {
    backgroundColor: '#F2F0EE',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  locationCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FBE9E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  pickupInfo: {
    flex: 1,
    marginLeft: 10,
  },

  pickupLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#938681',
    letterSpacing: 0.5,
  },

  pickupName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A332C',
    marginTop: 2,
  },

  campusBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  campusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#554640',
  },

  readyCard: {
    backgroundColor: '#FCEAE3',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },

  bolt: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#6D554C',
    marginRight: 10,
  },

  readyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A332C',
  },

  readyDescription: {
    fontSize: 9,
    color: '#8D7D77',
    marginTop: 2,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  subtotalLabel: {
    fontSize: 10,
    color: '#958781',
  },

  subtotal: {
    fontSize: 10,
    color: '#4A332C',
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#EEE9E6',
    marginVertical: 12,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '700',
    color: '#4A332C',
  },

  iva: {
    fontSize: 8,
    color: '#A09590',
    marginTop: 2,
  },

  total: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A332C',
  },

  paymentButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4A332C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 8,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 8,
    color: '#9B908B',
    marginTop: 8,
  },
});

export default CartScreen;