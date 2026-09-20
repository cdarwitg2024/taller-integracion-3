import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';

import ProductCard from '../components/ProductCard';

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} description
 * @property {number} price
 * @property {string} emoji
 * @property {boolean} available
 * @property {'Bebidas' | 'Alimentos'} category
 */

/** @type {Product[]} */
const products = [
  {
    id: 1,
    name: 'Café Latte Vainilla',
    description: 'Grande • Leche descremada',
    price: 2400,
    emoji: '☕',
    available: true,
    category: 'Bebidas',
  },
  {
    id: 2,
    name: 'Sándwich Ave Palta',
    description: 'Pan rústico integral',
    price: 3600,
    emoji: '🥪',
    available: true,
    category: 'Alimentos',
  },
  {
    id: 3,
    name: 'Muffin de Arándanos',
    description: 'Recién horneado',
    price: 1800,
    emoji: '🧁',
    available: true,
    category: 'Alimentos',
  },
  {
    id: 4,
    name: 'Jugo Natural',
    description: 'Naranja recién exprimida',
    price: 2000,
    emoji: '🧃',
    available: false,
    category: 'Bebidas',
  },
];

const categories = [
  {
    name: 'Bebidas',
    data: products.filter(
      (product) => product.category === 'Bebidas'
    ),
  },
  {
    name: 'Alimentos',
    data: products.filter(
      (product) => product.category === 'Alimentos'
    ),
  },
];

/**
 * @param {{
 *   onAddToCart: (product: Product) => void
 * }} props
 */
const MenuScreen = ({ onAddToCart }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Menú</Text>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Estás viendo los Productos de la cafetería de
            {'\n'}
            Lopez cafetería
          </Text>
        </View>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.name}
            </Text>

            {category.data.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={onAddToCart}
              />
            ))}
          </View>
        )}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A332C',
  },

  headerIcon: {
    position: 'absolute',
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#4A332C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconText: {
    color: '#FFFFFF',
    fontSize: 14,
  },

  infoCard: {
    marginTop: 10,
    backgroundColor: '#F5F2F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },

  infoText: {
    color: '#4A332C',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },

  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },

  categorySection: {
    marginBottom: 8,
  },

  categoryTitle: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    color: '#4A332C',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 18,
    marginBottom: 10,
  },
});

export default MenuScreen;