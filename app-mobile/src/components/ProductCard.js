import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const ProductCard = ({ product, onAdd }) => {
  const handleAdd = () => {
    if (!product.available) {
      return;
    }

    onAdd(product);
  };

  return (
    <View style={styles.container}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageEmoji}>
          {product.emoji}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>
          {product.name}
        </Text>

        <Text style={styles.description}>
          {product.description}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.price}>
            ${product.price.toLocaleString('es-CL')}
          </Text>

          <TouchableOpacity
            style={[
              styles.addButton,
              !product.available && styles.disabledButton,
            ]}
            onPress={handleAdd}
            disabled={!product.available}
          >
            <Text style={styles.addButtonText}>
              {product.available
                ? 'Añadir al carrito'
                : 'No disponible'}
            </Text>
          </TouchableOpacity>
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

    elevation: 3,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },

  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 13,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  imageEmoji: {
    fontSize: 34,
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
    fontSize: 10,
    color: '#8A7B76',
    marginTop: 2,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },

  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A332C',
  },

  addButton: {
    backgroundColor: '#F5F1EE',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  disabledButton: {
    backgroundColor: '#D8D3D0',
  },

  addButtonText: {
    color: '#4A332C',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default ProductCard;