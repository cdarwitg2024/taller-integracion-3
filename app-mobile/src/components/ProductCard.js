import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import Icon from './Icon';

const getProductIconName = (product) => {
  const name = (product?.name || '').toLowerCase();
  const category = (product?.category || '').toLowerCase();
  const text = `${category} ${name}`;

  if (/café|cafe|espresso|capuchino|americano|latte|moka|flat white/i.test(text)) {
    return 'cafe-outline';
  }
  if (/té|te\b|chai|infusión|infusion|mate/i.test(text)) {
    return 'leaf-outline';
  }
  if (/leche|lacteo|lácteo|yogur|malteada/i.test(text)) {
    return 'beer-outline';
  }
  if (/sándwich|sandwich|panini|jamón|jamon|queso|tostada|baguette/i.test(text)) {
    return 'restaurant-outline';
  }
  if (/empanada|pan\b|medialuna|croissant|bollo|hallulla|marraqueta/i.test(text)) {
    return 'restaurant-outline';
  }
  if (/galleta|cookie|muffin|kuchen|torta|pastel|repost|brownie|donut|berlín|berlin/i.test(text)) {
    return 'ice-cream-outline';
  }
  if (/jugo|bebida|refresco|agua|mineral|limonada|naranja|fruta/i.test(text)) {
    return 'beer-outline';
  }
  if (/ensalada|wrap|bowl/i.test(text)) {
    return 'nutrition-outline';
  }
  return 'fast-food-outline';
};

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
 * `onPress` es opcional (FR-08): si viene, la tarjeta completa se vuelve
 * clickeable para abrir el detalle del producto.
 *
 * `onAdd` se dispara únicamente si el producto está disponible. Quien lo use
 * (hoy el carrito, mañana el checkout) no tiene que volver a validar nada.
 */
const ProductCard = ({ product, onAdd, onPress }) => {
  const { available, stock, stockMin = 0 } = product;

  // Si la URL de la imagen existe pero no carga (404, host caído), caemos al
  // emoji en vez de dejar un cuadro gris vacío sin explicación.
  const [imagenCaida, setImagenCaida] = useState(false);
  // La imagen aparece recién cuando carga (fade), y mientras tanto se ve el
  // emoji de fondo:
  const [imagenCargada, setImagenCargada] = useState(false);

  // Si cambia de producto (reutilización del componente en la lista), hay que
  // volver a intentar la imagen nueva.
  useEffect(() => {
    setImagenCaida(false);
    setImagenCargada(false);
  }, [product.imageUrl]);

  const handleAdd = () => {
    if (!available) return;
    onAdd?.(product);
  };

  // "Últimas unidades" aparece solo cuando queda poco respecto al mínimo
  const quedanPocas = available && stock <= stockMin;

  return (
    <TouchableOpacity
      style={[styles.container, !available && styles.containerDisabled]}
      onPress={onPress ? () => onPress(product) : undefined}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress ? `Ver detalle de ${product.name}` : `${product.name}, ${product.price} pesos`
      }
    >
      <View style={styles.imagePlaceholder}>
        {/*
         * Carga diferida + placeholder que no se vea roto:
         * - El icono queda siempre como capa base, así nunca hay un cuadro
         *   vacío mientras la imagen baja.
         * - La <Image> se monta con opacidad 0 y aparece (fade) recién al
         *   terminar de cargar (onLoad). Si falla, queda el icono.
         * - Esto + FlatList (que sólo renderiza las filas visibles de la
         *   ventana) evita cargar imágenes lejanas.
         */}
        <Icon name={getProductIconName(product)} size={34} color={colors.cafeOscuro} />

        {product.imageUrl && !imagenCaida ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={[
              styles.image,
              { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: imagenCargada ? 1 : 0 },
            ]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onLoad={() => setImagenCargada(true)}
            onError={() => {
              setImagenCaida(true);
              setImagenCargada(false);
            }}
          />
        ) : null}

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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 12,

    elevation: 3,

    shadowColor: colors.sombra,
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
    backgroundColor: colors.superficieCrema,
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
    backgroundColor: colors.overlayOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  soldOutText: {
    color: colors.textoBlanco,
    fontSize: typography.micro,
    fontWeight: typography.pesoExtraBold,
    letterSpacing: 0.5,
  },

  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },

  name: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.textoOscuro,
  },

  description: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
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
    backgroundColor: colors.verdeStock,
    marginRight: 5,
  },

  dotLow: {
    backgroundColor: colors.naranjaStock,
  },

  dotOut: {
    backgroundColor: colors.rojoStock,
  },

  stockText: {
    fontSize: typography.etiqueta,
    color: colors.verdeStock,
    fontWeight: typography.pesoMedio,
  },

  stockTextLow: {
    color: colors.naranjaStock,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },

  price: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.textoPrimario,
  },

  addButton: {
    backgroundColor: colors.cremaBoton,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  disabledButton: {
    backgroundColor: colors.deshabilitado,
  },

  addButtonText: {
    color: colors.textoPrimario,
    fontSize: 9,
    fontWeight: typography.pesoBold,
  },
});

export default ProductCard;