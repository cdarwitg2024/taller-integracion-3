import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import ProductCard from '../components/ProductCard';
import { supabase } from '../lib/supabase';

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} description
 * @property {number} price
 * @property {string} emoji
 * @property {boolean} available
 * @property {string} category
 */

const DEFAULT_EMOJI = '🍽';

const EMOJI_RULES = [
  { cv: /café|cafe|espresso|capuchino|americano|latte/i, emoji: '☕' },
  { cv: /té|te\b|chai|infusión|infusion/i, emoji: '🍵' },
  { cv: /leche|lácteo|yogur|yogurt/i, emoji: '🥛' },
  { cv: /sándwich|sandwich|ave |jamón|jamon|queso|croissant/i, emoji: '🥪' },
  { cv: /empanada|pan|medialuna|bollo/i, emoji: '🥐' },
  { cv: /muffin|galleta|cookie|kuchen|torta|pastel|repostería|reposteria/i, emoji: '🧁' },
  { cv: /jugo|bebida|refresco|agua|limonada/i, emoji: '🧃' },
  { cv: /azúcar|azucar|insumo/i, emoji: '📦' },
];

const getEmoji = (product) => {
  const text = `${product.categoria || ''} ${product.name} ${product.description}`;
  const rule = EMOJI_RULES.find((r) => r.cv.test(text));
  return rule ? rule.emoji : DEFAULT_EMOJI;
};

const mapProduct = (raw) => ({
  id: raw.id,
  name: raw.nombre || 'Producto',
  description: raw.descripcion || '',
  price: Number(raw.precio) || 0,
  emoji: getEmoji({
    name: raw.nombre || '',
    description: raw.descripcion || '',
    categoria: raw.categorias?.nombre || '',
  }),
  available: Boolean(raw.activo) && Number(raw.stock ?? 1) > 0,
  category: raw.categorias?.nombre || 'General',
});

/** Catálogo de respaldo (menú de demostración) */
const FALLBACK_PRODUCTS = [
  {
    id: 'fallback-1',
    name: 'Café Latte Vainilla',
    description: 'Grande • Leche descremada',
    price: 2400,
    emoji: '☕',
    available: true,
    category: 'Bebidas',
  },
  {
    id: 'fallback-2',
    name: 'Sándwich Ave Palta',
    description: 'Pan rústico integral',
    price: 3600,
    emoji: '🥪',
    available: true,
    category: 'Alimentos',
  },
  {
    id: 'fallback-3',
    name: 'Muffin de Arándanos',
    description: 'Recién horneado',
    price: 1800,
    emoji: '🧁',
    available: true,
    category: 'Alimentos',
  },
  {
    id: 'fallback-4',
    name: 'Jugo Natural',
    description: 'Naranja recién exprimida',
    price: 2000,
    emoji: '🧃',
    available: false,
    category: 'Bebidas',
  },
];

const MenuScreen = ({ cafeteria, onAddToCart, onBack }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const cafeteriaId = cafeteria?.id;
      if (!cafeteriaId) {
        setProducts([]);
        return;
      }

      const { data, error } = await supabase
        .from('productos')
        .select('*, categorias(nombre)')
        .eq('cafeteria_id', cafeteriaId)
        .eq('activo', true);

      if (error) throw error;

      const mapped = (data || []).map(mapProduct);
      // Si la cafetería no tiene productos registrados, se muestra el menú de demostración
      setProducts(mapped.length > 0 ? mapped : FALLBACK_PRODUCTS);
    } catch (err) {
      console.warn('No se pudieron cargar los productos:', err);
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [cafeteria?.id]);

  const categories = products.reduce((acc, product) => {
    const list = acc.find((c) => c.name === product.category);
    if (list) {
      list.data.push(product);
    } else {
      acc.push({ name: product.category, data: [product] });
    }
    return acc;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Menú</Text>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Estás viendo los Productos de
            {'\n'}
            {cafeteria?.nombre || 'la cafetería seleccionada'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4A332C" style={{ marginTop: 48 }} />
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>☕</Text>
          <Text style={styles.emptyTitle}>Sin productos disponibles</Text>
          <Text style={styles.emptyDescription}>
            Esta cafetería aún no tiene productos en su menú. Prueba con otra cafetería o
            revisa más tarde.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onBack}>
            <Text style={styles.emptyButtonText}>Elegir otra cafetería</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
      )}
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

  backButton: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    justifyContent: 'center',
  },

  backText: {
    fontSize: 32,
    color: '#4A332C',
    lineHeight: 32,
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

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A332C',
  },

  emptyDescription: {
    fontSize: 12,
    color: '#958781',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },

  emptyButton: {
    marginTop: 20,
    backgroundColor: '#F5ECE5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A332C',
  },
});

export default MenuScreen;