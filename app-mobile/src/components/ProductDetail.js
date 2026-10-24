import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import Icon from './Icon';

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
 *
 * @type {React.FC<{
 *   product: any,
 *   onAdd: (producto: any, cantidad: number, modificaciones?: string[]) => void,
 *   onClose: () => void,
 *   cafeteriaName?: string,
 * }>}
 */
const ProductDetail = ({ product, onAdd, onClose, cafeteriaName }) => {
  // Si la URL de la imagen existe pero no carga (404, host caído), caemos al
  // emoji en vez de dejar el hueco vacío sin explicación. El hook va antes
  // del `return null` de abajo para respetar el orden de los hooks.
  const [imagenCaida, setImagenCaida] = useState(false);

  useEffect(() => {
    setImagenCaida(false);
  }, [product?.imageUrl]);

  if (!product) return null;

  const { available, stock, stockMin = 0 } = product;
  const quedanPocas = available && stock <= stockMin;
  const porcentajeStock = stockMin > 0 ? Math.min(100, Math.round((stock / stockMin) * 100)) : 100;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Imagen grande */}
        <View style={styles.hero}>
          {product.imageUrl && !imagenCaida ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              onError={() => setImagenCaida(true)}
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
            {/* S2-T3: icono vectorial en vez del glifo '✕'. */}
            <Icon name="close" size={22} color={colors.textoPrimario} />
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
    backgroundColor: colors.fondo,
  },

  scroll: {
    paddingBottom: 12,
  },

  hero: {
    height: 230,
    backgroundColor: colors.superficieCrema,
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
    backgroundColor: colors.overlayOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  soldOutText: {
    color: colors.textoBlanco,
    fontSize: 13,
    fontWeight: typography.pesoExtraBold,
    letterSpacing: 1,
  },

  closeButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blancoOverlay,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.superficieCremaSuave,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    maxWidth: '80%',
  },

  tagText: {
    color: colors.textoMedio,
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
  },

  name: {
    fontSize: 22,
    fontWeight: typography.pesoExtraBold,
    color: colors.textoOscuro,
  },

  price: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoExtraBold,
    color: colors.textoPrimario,
    marginTop: 4,
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoExtraBold,
    color: colors.textoMedio,
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

  dotOk: { backgroundColor: colors.verdeStock },
  dotLow: { backgroundColor: colors.naranjaStock },
  dotOut: { backgroundColor: colors.rojoStock },

  availabilityText: {
    fontSize: 13,
    fontWeight: typography.pesoBold,
  },

  textOk: { color: colors.verdeStock },
  textLow: { color: colors.naranjaStock },
  textOut: { color: colors.rojoStock },

  stockBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.stockTrack,
    marginTop: 10,
    overflow: 'hidden',
  },

  stockBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  stockBarOk: { backgroundColor: colors.verdeStock },
  stockBarLow: { backgroundColor: colors.naranjaStock },

  stockHint: {
    fontSize: typography.etiqueta,
    color: colors.textoTenue,
    marginTop: 6,
    lineHeight: 15,
  },

  description: {
    fontSize: 13,
    color: colors.textoMedio,
    lineHeight: 20,
  },

  modRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },

  modBullet: {
    color: colors.naranjaStock,
    fontSize: 13,
    marginRight: 6,
  },

  modText: {
    flex: 1,
    fontSize: typography.cuerpoPequeno,
    color: colors.textoMedio,
    lineHeight: 18,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.blanco,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.bordeSuave,
  },

  footerPrice: {},

  footerPriceLabel: {
    fontSize: typography.etiqueta,
    color: colors.textoTenue,
    fontWeight: typography.pesoMedio,
  },

  footerPriceValue: {
    fontSize: 18,
    fontWeight: typography.pesoExtraBold,
    color: colors.textoPrimario,
  },

  addButton: {
    backgroundColor: colors.textoPrimario,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },

  addButtonDisabled: {
    backgroundColor: colors.deshabilitado,
  },

  addButtonText: {
    color: colors.textoBlanco,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
  },
});

export default ProductDetail;
