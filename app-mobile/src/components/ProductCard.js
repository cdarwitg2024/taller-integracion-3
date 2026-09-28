import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';

/**
 * Tarjeta de un producto del menú.
 *
 * Es un componente presentacional y reutilizable: no consulta nada y no sabe
 * de cafeterías ni de Supabase. Solo recibe el producto ya normalizado por
 * `mapProduct` (ver src/screens/MenuScreen.js) y un callback `onAdd`.
 *
 * Contrato que espera del producto:
 *   id, name, description, price, emoji, imageUrl, stock, stockMin, available
 *
 * `onAdd` se dispara únicamente si el producto está disponible. Quien lo use
 * (hoy el carrito, mañana el checkout) no tiene que volver a validar nada.
 */
const ProductCard = ({ product, onAdd }) => {
  const { available, stock, stockMin = 0 } = product;

  const handleAdd = () => {
    if (!available) return;
    onAdd?.(product);
  };

  // "Últimas unidades" aparece solo cuando queda poco respecto al mínimo
  const quedanPocas = available && stock <= stockMin;

  return (
    <View style={[styles.container, !available && styles.containerDisabled]}>
      <View style={styles.imagePlaceholder}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.imageEmoji}>{product.emoji}</Text>
        )}

        {!available && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>AGOTADO</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>

        {!!product.description && (
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        )}

        <View style={styles.stockRow}>
          {available ? (
            <>
              <View style={[styles.dot, quedanPocas && styles.dotLow]} />
              <Text style={[styles.stockText, quedanPocas && styles.stockTextLow]}>
                {quedanPocas ? `Quedan ${stock}` : 'Disponible'}
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.dot, styles.dotOut]} />
              <Text style={styles.stockText}>No disponible</Text>
            </>
          )}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.price}>${product.price.toLocaleString('es-CL')}</Text>

          <TouchableOpacity
            style={[styles.addButton, !available && styles.disabledButton]}
            onPress={handleAdd}
            disabled={!available}
            accessibilityRole="button"
            accessibilityLabel={
              available ? `Agregar ${product.name} al carrito` : `${product.name} no disponible`
            }
            accessibilityState={{ disabled: !available }}
          >
            <Text style={styles.addButtonText}>
              {available ? 'Añadir al carrito' : 'No disponible'}
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

  // Apagado visualmente cuando no hay stock
  containerDisabled: {
    opacity: 0.62,
  },

  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 13,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imageEmoji: {
    fontSize: 34,
  },

  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 51, 44, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  soldOutText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
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

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5B8C5A',
    marginRight: 5,
  },

  dotLow: {
    backgroundColor: '#B8860B',
  },

  dotOut: {
    backgroundColor: '#B05A4E',
  },

  stockText: {
    fontSize: 10,
    color: '#5B8C5A',
    fontWeight: '600',
  },

  stockTextLow: {
    color: '#B8860B',
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