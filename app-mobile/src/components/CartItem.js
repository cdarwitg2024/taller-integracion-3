import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const CartItem = ({
  item,
  onIncrease,
  onDecrease,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageEmoji}>{item.emoji}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        <Text style={styles.description}>
          {item.description}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.price}>
            ${item.price.toLocaleString('es-CL')}
          </Text>

          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onDecrease(item.id)}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantity}>
              {item.quantity}
            </Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onIncrease(item.id)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  imagePlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  imageEmoji: {
    fontSize: 32,
  },

  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },

  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B26',
  },

  description: {
    fontSize: 11,
    color: '#8A7B76',
    marginTop: 3,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A332C',
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F5F3',
    borderRadius: 20,
    paddingHorizontal: 4,
  },

  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantityButtonText: {
    fontSize: 17,
    color: '#7C6B65',
  },

  quantity: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 12,
    color: '#4A332C',
  },
});

export default CartItem;