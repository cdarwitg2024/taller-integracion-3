import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

/**
 * Detalle de un producto — FR-08
 *
 * Componente presentacional y reutilizable: no consulta nada, solo muestra el
 * producto que le pasan. La carga de datos es responsabilidad de quien lo
 * monta (ver `ProductDetailScreen`).
 *
 * Contrato del producto:
 *   id, name, description, price, imageUrl, emoji, stock, stockMin,
 *   available, category, cafeteriaName, modifications (array de strings)
 */
const ProductDetail = ({ product, onAdd, onClose, cafeteriaName }) => {
  if (!product) return null;

  const { available, stock, stockMin = 0 } = product;
  const quedanPocas = available && stock <= stockMin;
  const porcentajeStock = stockMin > 0 ? Math.min(100, Math.round((stock / stockMin) * 100)) : 100;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Imagen grande */}
        <View style={styles.hero}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={styles.heroEmoji}>{product.emoji}</Text>
          )}

          {!available && (
            <View style={styles.soldOutOverlay}>
              <Text style={styles.soldOutText}>AGOTADO</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar detalle"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Categoría + cafetería: mantienen el contexto al navegar */}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{product.category}</Text>
            </View>
            {cafeteriaName ? (
              <View style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {cafeteriaName}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.name}>{product.name}</Text>

          <Text style={styles.price}>${product.price.toLocaleString('es-CL')}</Text>

          {/* Disponibilidad */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disponibilidad</Text>

            <View style={styles.availabilityRow}>
              <View
                style={[
                  styles.dot,
                  !available
                    ? styles.dotOut
                    : quedanPocas
                    ? styles.dotLow
                    : styles.dotOk,
                ]}
              />
              <Text
                style={[
                  styles.availabilityText,
                  !available
                    ? styles.textOut
                    : quedanPocas
                    ? styles.textLow
                    : styles.textOk,
                ]}
              >
                {!available
                  ? 'No disponible por el momento'
                  : quedanPocas
                  ? `Quedan ${stock} unidades`
                  : 'Disponible'}
              </Text>
            </View>

            {available && (
              <View style={styles.stockBarTrack}>
                <View
                  style={[
                    styles.stockBarFill,
                    quedanPocas ? styles.stockBarLow : styles.stockBarOk,
                    { width: `${porcentajeStock}%` },
                  ]}
                />
              </View>
            )}

            {stockMin > 0 && (
              <Text style={styles.stockHint}>
                {available
                  ? `Unidades de stock: ${stock} (mínimo de reposición: ${stockMin})`
                  : 'Se avisará al equipo de cafetería para reponer stock.'}
              </Text>
            )}
          </View>

          {/* Descripción */}
          {!!product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {/* Modificaciones / personalización (FR-08: información relevante) */}
          {Array.isArray(product.modifications) && product.modifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Puedes personalizar</Text>
              {product.modifications.map((mod) => (
                <View key={mod} style={styles.modRow}>
                  <Text style={styles.modBullet}>•</Text>
                  <Text style={styles.modText}>{mod}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barra fija de acción */}
      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceLabel}>Total</Text>
          <Text style={styles.footerPriceValue}>
            ${product.price.toLocaleString('es-CL')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, !available && styles.addButtonDisabled]}
          onPress={() => available && onAdd?.(product)}
          disabled={!available}
          accessibilityRole="button"
          accessibilityState={{ disabled: !available }}
        >
          <Text style={styles.addButtonText}>
            {available ? 'Añadir al carrito' : 'No disponible'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },

  scroll: {
    paddingBottom: 12,
  },

  hero: {
    height: 230,
    backgroundColor: '#F3E7DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  heroEmoji: {
    fontSize: 92,
  },

  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 51, 44, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  soldOutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },

  closeButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    color: '#4A332C',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },

  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },

  tag: {
    backgroundColor: '#F0E7E0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    maxWidth: '80%',
  },

  tagText: {
    color: '#6B5850',
    fontSize: 10,
    fontWeight: '700',
  },

  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3D2B26',
  },

  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4A332C',
    marginTop: 4,
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B5850',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  dotOk: { backgroundColor: '#5B8C5A' },
  dotLow: { backgroundColor: '#B8860B' },
  dotOut: { backgroundColor: '#B05A4E' },

  availabilityText: {
    fontSize: 13,
    fontWeight: '700',
  },

  textOk: { color: '#5B8C5A' },
  textLow: { color: '#B8860B' },
  textOut: { color: '#B05A4E' },

  stockBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E6DED8',
    marginTop: 10,
    overflow: 'hidden',
  },

  stockBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  stockBarOk: { backgroundColor: '#5B8C5A' },
  stockBarLow: { backgroundColor: '#B8860B' },

  stockHint: {
    fontSize: 10,
    color: '#958781',
    marginTop: 6,
    lineHeight: 15,
  },

  description: {
    fontSize: 13,
    color: '#6B5850',
    lineHeight: 20,
  },

  modRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },

  modBullet: {
    color: '#B8860B',
    fontSize: 13,
    marginRight: 6,
  },

  modText: {
    flex: 1,
    fontSize: 12,
    color: '#6B5850',
    lineHeight: 18,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#EFE8E3',
  },

  footerPrice: {},

  footerPriceLabel: {
    fontSize: 10,
    color: '#958781',
    fontWeight: '600',
  },

  footerPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A332C',
  },

  addButton: {
    backgroundColor: '#4A332C',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },

  addButtonDisabled: {
    backgroundColor: '#D8D3D0',
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ProductDetail;
