import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import ProductCard from '../components/ProductCard';
import { supabase } from '../lib/supabase';
import { useDisponibilidadProductos } from '../hooks/useDisponibilidadProductos';

/**
 * Pantalla de Menú de una cafetería — FR-06
 *
 * Reglas del requisito:
 *   - consultar los productos de la cafetería SELECCIONADA
 *   - mostrar nombre, precio y disponibilidad
 *   - diferenciar disponibles de no disponibles
 *   - NUNCA mostrar productos de otras cafeterías
 *   - dejar el producto listo para que el Integrante 2 lo agregue al carrito
 *
 * Decisión de diseño importante: si la cafetería no tiene productos, NO se
 * inventan productos de ejemplo. Se muestra el estado vacío. Antes sí lo hacía
 * (FALLBACK_PRODUCTS) y eso rompía el requisito de no mostrar productos de
 * otras cafeterías, además de mandar ids tipo 'fallback-1' a una columna
 * bigint en el checkout.
 */

const DEFAULT_EMOJI = '🍽';

const EMOJI_RULES = [
  { cv: /café|cafe|espresso|capuchino|americano|latte/i, emoji: '☕' },
  { cv: /té|\bte\b|chai|infusión|infusion/i, emoji: '🍵' },
  { cv: /leche|lácteo|lacteo|yogur/i, emoji: '🥛' },
  { cv: /sándwich|sandwich|ave |jamón|jamon|queso|croissant/i, emoji: '🥪' },
  { cv: /empanada|pan|medialuna|bollo/i, emoji: '🥐' },
  { cv: /muffin|galleta|cookie|kuchen|torta|pastel|reposter/i, emoji: '🧁' },
  { cv: /jugo|bebida|refresco|agua|limonada/i, emoji: '🧃' },
];

/** Elige un emoji a partir del nombre, la categoría y la descripción. */
export const getEmoji = ({ name = '', description = '', category = '' }) => {
  const rule = EMOJI_RULES.find((r) => r.cv.test(`${category} ${name} ${description}`));
  return rule ? rule.emoji : DEFAULT_EMOJI;
};

/**
 * Convierte una fila de `productos` al formato que consume la UI y el carrito.
 *
 * `stock` null o no numérico se trata como 0 (agotado), no como 1. Antes se
 * usaba `stock ?? 1`, que hacía pasar por disponible un producto sin stock.
 */
export const mapProduct = (raw) => {
  const stock = Number.isFinite(Number(raw.stock)) ? Number(raw.stock) : 0;
  const activo = raw.activo !== false && raw.activo !== null;
  const eliminado = Boolean(raw.eliminado_en);

  return {
    // id real de la base: es lo que despues va como `producto_id` en
    // `detalles_pedido`, asi que SIEMPRE tiene que ser numerico.
    id: Number(raw.id),
    cafeteriaId: Number(raw.cafeteria_id),

    name: raw.nombre || 'Producto',
    description: raw.descripcion || '',
    price: Number(raw.precio) || 0,
    imageUrl: raw.imagen_url || null,

    stock,
    stockMin: Number.isFinite(Number(raw.stock_minimo)) ? Number(raw.stock_minimo) : 0,
    // `available` es el contrato que ya usan ProductCard y App.tsx
    available: activo && !eliminado && stock > 0,
    category: raw.categorias?.nombre || 'General',
    emoji: getEmoji({
      name: raw.nombre || '',
      description: raw.descripcion || '',
      category: raw.categorias?.nombre || '',
    }),
  };
};

/** Agrupa por categoría conservando el orden en que llegan. */
const groupByCategory = (products) =>
  products.reduce((acc, product) => {
    const existing = acc.find((c) => c.name === product.category);
    if (existing) {
      existing.data.push(product);
    } else {
      acc.push({ name: product.category, data: [product] });
    }
    return acc;
  }, []);

const MenuScreen = ({ cafeteria, onAddToCart, onBack }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const cafeteriaId = cafeteria?.id ?? null;

  // FR-10: escucha cambios de stock/activo de los productos de esta cafetería.
  // El hook se suscribe, se desuscribe solo y no duplica canales.
  const { connected, cambios } = useDisponibilidadProductos(cafeteriaId);

  // Aplicamos el cambio en el producto afectado sin volver a traer la lista
  // entera. Es lo que hace que la UI se vea instantánea.
  useEffect(() => {
    if (!cambios.length) return;
    const pendiente = cambios[0];

    // Producto nuevo o eliminado en cascada: recargamos la lista
    if (pendiente.recargar || pendiente.eliminadoId) {
      fetchProducts({ silent: true });
      return;
    }

    if (Number.isFinite(pendiente.id)) {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== pendiente.id) return p;

          const stock = pendiente.stock;
          const activo = pendiente.activo;
          const eliminado = Boolean(pendiente.eliminadoEn);

          // Si lo dejaron inactivo o lo borraron, sale de la lista
          if (!activo || eliminado) {
            return prev.filter((x) => x.id !== pendiente.id);
          }

          return { ...p, stock, available: stock > 0 };
        })
      );
    }
  }, [cambios]);

  const fetchProducts = useCallback(
    async ({ silent = false } = {}) => {
      if (!cafeteriaId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('productos')
          .select('id, cafeteria_id, categoria_id, nombre, descripcion, precio, imagen_url, stock, stock_minimo, activo, eliminado_en, categorias(nombre)')
          .eq('cafeteria_id', cafeteriaId)
          .eq('activo', true)
          .is('eliminado_en', null);

        if (queryError) throw queryError;

        // Cinturón de seguridad: aunque la consulta ya filtra, descartamos
        // cualquier fila que venga de otra cafetería. Así el requisito "no
        // mostrar productos de otras cafeterías" se cumple por partida doble.
        const propios = (data || []).filter(
          (row) => Number(row.cafeteria_id) === Number(cafeteriaId)
        );

        // productsMap mantiene el id numérico, que es lo que necesita el carrito
        setProducts(propios.map(mapProduct).filter((p) => Number.isFinite(p.id)));
      } catch (err) {
        console.warn('[MenuScreen] No se pudieron cargar los productos:', err);
        setProducts([]);
        setError(
          err?.message === 'Failed to fetch'
            ? 'No pudimos conectarnos. Revisa tu conexión a internet.'
            : 'No se pudo cargar el menú de esta cafetería.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cafeteriaId]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => groupByCategory(products), [products]);

  const disponibles = products.filter((p) => p.available).length;

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts({ silent: true });
  };

  const handleAdd = (product) => {
    // Cinturón de seguridad también del lado del carrito: nunca agregar
    // un producto que no sea de esta cafetería o que esté agotado.
    if (!product?.available) return;
    if (Number(product.cafeteriaId) !== Number(cafeteriaId)) return;
    onAddToCart?.(product);
  };

  const renderBody = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#4A332C" style={styles.loader} />;
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateEmoji}>📡</Text>
          <Text style={styles.stateTitle}>Sin conexión con el menú</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => fetchProducts()}>
            <Text style={styles.stateButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (products.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateEmoji}>☕</Text>
          <Text style={styles.stateTitle}>Esta cafetería no tiene menú</Text>
          <Text style={styles.stateText}>
            Todavía no hay productos cargados en {cafeteria?.nombre || 'esta cafetería'}.
            Probá con otra cafetería o volvé a revisar más tarde.
          </Text>
          <TouchableOpacity style={styles.stateButton} onPress={onBack}>
            <Text style={styles.stateButtonText}>Elegir otra cafetería</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={categories}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4A332C"
            colors={['#4A332C']}
          />
        }
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.data.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd} />
            ))}
          </View>
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Volver a las cafeterías"
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Menú</Text>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={[styles.liveDot, connected ? styles.liveDotOn : styles.liveDotOff]} />
          <Text style={styles.infoCafeteria} numberOfLines={1}>
            {cafeteria?.nombre || 'la cafetería seleccionada'}
          </Text>
          <Text style={styles.infoCount}>
            {connected ? productosSummary(disponibles, products.length) : 'Conectando…'}
          </Text>
        </View>
      </View>

      {renderBody()}
    </View>
  );
};

const productosSummary = (disponibles, total) => {
  if (total === 0) return 'Sin productos';
  if (disponibles === total) return `${total} producto${total === 1 ? '' : 's'}`;
  return `${disponibles} de ${total} disponibles`;
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

  // Indicador de que la suscripción en vivo está activa (FR-10)
  liveDot: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  liveDotOn: {
    backgroundColor: '#5B8C5A',
  },

  liveDotOff: {
    backgroundColor: '#C9A227',
  },

  infoCafeteria: {
    color: '#4A332C',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  infoCount: {
    color: '#8A7B76',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  loader: {
    marginTop: 48,
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

  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  stateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },

  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A332C',
    textAlign: 'center',
  },

  stateText: {
    fontSize: 12,
    color: '#958781',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },

  stateButton: {
    marginTop: 20,
    backgroundColor: '#F5ECE5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },

  stateButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A332C',
  },
});

export default MenuScreen;