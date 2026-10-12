import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  TextInput,
} from 'react-native';

import ProductCard from '../components/ProductCard';
import ProductDetail from '../components/ProductDetail';
import CategoryFilter from '../components/CategoryFilter';
import Button from '../components/Button';
import Card from '../components/Card';
import { supabase } from '../lib/supabase';
import { useDisponibilidadProductos } from '../hooks/useDisponibilidadProductos';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

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
    // FR-07: el filtro trabaja por id, no por nombre. Guardamos ambos.
    categoryId: Number.isFinite(Number(raw.categoria_id)) ? Number(raw.categoria_id) : null,
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

  // FR-07: categoría activa. 'todos' = sin filtro
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  // FR-15: búsqueda por texto con debounce + orden del catálogo
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [orden, setOrden] = useState('precio_asc');
  // FR-08: producto abierto en detalle. La cafetería NO se pasa: el detalle se
  // muestra encima del menú, así que el contexto se mantiene solo.
  const [productoDetalle, setProductoDetalle] = useState(null);

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

  // FR-15: debounce de 300 ms para no refiltrar en cada tecla que se escribe.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(id);
  }, [busqueda]);

  // FR-07: categorías que TIENEN productos. Armadas por id, no por nombre,
  // porque en la base hay 'Repostería' y 'Reposteria' como filas distintas.
  const categories = useMemo(() => {
    const porId = new Map();
    products.forEach((p) => {
      const id = p.categoryId ?? 'sin-categoria';
      const actual = porId.get(id);
      if (actual) {
        actual.count += 1;
      } else {
        porId.set(id, { id, nombre: p.category, count: 1 });
      }
    });
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [products]);

  // Filtrado combinado: categoría + búsqueda por texto (FR-15)
  const productosFiltrados = useMemo(() => {
    let lista = products;
    if (categoriaActiva !== 'todos') {
      lista = lista.filter((p) => String(p.categoryId ?? 'sin-categoria') === String(categoriaActiva));
    }
    if (busquedaDebounced) {
      lista = lista.filter((p) => (p.name || '').toLowerCase().includes(busquedaDebounced));
    }
    return lista;
  }, [products, categoriaActiva, busquedaDebounced]);

  // Ordenamiento visible: precio o nombre, asc/desc (FR-15)
  const productosOrdenados = useMemo(() => {
    const lista = [...productosFiltrados];
    switch (orden) {
      case 'precio_asc':
        lista.sort((a, b) => a.price - b.price);
        break;
      case 'precio_desc':
        lista.sort((a, b) => b.price - a.price);
        break;
      case 'nombre_asc':
        lista.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'nombre_desc':
        lista.sort((a, b) => b.name.localeCompare(a.name, 'es'));
        break;
      default:
        break;
    }
    return lista;
  }, [productosFiltrados, orden]);

  // Agrupado por categoría, ya sobre la lista filtrada y ordenada
  const categoriasAgrupadas = useMemo(() => groupByCategory(productosOrdenados), [productosOrdenados]);

  const disponibles = productosOrdenados.filter((p) => p.available).length;

  // Al cambiar de cafetería, el filtro y el detalle se reinician
  useEffect(() => {
    setCategoriaActiva('todos');
    setProductoDetalle(null);
  }, [cafeteriaId]);

  // El detalle de producto es un overlay sobre el menú, no una pantalla
  // montada aparte. Por eso hay que hacerlo cerrar a mano con el botón
  // físico de atrás de Android. Este handler se registra después del de
  // App.tsx, y React Native invoca primero el último registrado, así que
  // el overlay gana y el usuario nunca sale de la app por error.
  useEffect(() => {
    if (!productoDetalle) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setProductoDetalle(null);
      return true;
    });

    return () => subscription.remove();
  }, [productoDetalle]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts({ silent: true });
  };

  const handleAdd = (product) => {
    // Cinturón de seguridad también del lado del carrito: nunca agregar
    // un producto que no sea de esta cafetería o que esté agotado.
    if (!product?.available) return;
    if (Number(product.cafeteriaId) !== Number(cafeteriaId)) return;
    // Se pasa la cafetería para que el carrito sepa a qué pedido pertenece
    // cada ítem y no mezcle productos de dos menus distintos.
    onAddToCart?.(product, cafeteria);
    // Si venía desde el detalle, se cierra para volver al menú
    setProductoDetalle(null);
  };

  const renderBody = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={colors.cafeOscuro} style={styles.loader} />;
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateEmoji}>📡</Text>
          <Text style={styles.stateTitle}>Sin conexión con el menú</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Button
            title="Reintentar"
            variant="secondary"
            size="sm"
            onPress={() => fetchProducts()}
            style={{ marginTop: spacing.xl }}
          />
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
          <Button
            title="Elegir otra cafetería"
            variant="secondary"
            size="sm"
            onPress={onBack}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      );
    }

    if (productosFiltrados.length === 0) {
      // Primero se distingue búsqueda sin resultados de "no hay productos".
      if (busquedaDebounced) {
        return (
          <View style={styles.stateContainer}>
            <Text style={styles.stateEmoji}>🔍</Text>
            <Text style={styles.stateTitle}>Sin resultados</Text>
            <Text style={styles.stateText}>
              No encontramos productos que coincidan con “{busquedaDebounced}”.
              Probá con otro nombre o cambia la categoría.
            </Text>
            <Button
              title="Limpiar búsqueda"
              variant="secondary"
              size="sm"
              onPress={() => setBusqueda('')}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        );
      }

      // El menú tiene productos pero el filtro de categoría no
      const catNombre = categories.find((c) => String(c.id) === String(categoriaActiva))?.nombre;
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateEmoji}>🔍</Text>
          <Text style={styles.stateTitle}>Sin productos en esta categoría</Text>
          <Text style={styles.stateText}>
            No hay productos disponibles en {catNombre || 'la categoría seleccionada'}.
          </Text>
          <Button
            title="Ver todas las categorías"
            variant="secondary"
            size="sm"
            onPress={() => setCategoriaActiva('todos')}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      );
    }

    return (
      <FlatList
        style={styles.listFlex}
        data={categoriasAgrupadas}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.cafeOscuro}
            colors={[colors.cafeOscuro]}
          />
        }
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.data.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
                onPress={setProductoDetalle}
              />
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

        <Card padding="sm" style={styles.infoCard}>
          <View style={[styles.liveDot, connected ? styles.liveDotOn : styles.liveDotOff]} />
          <Text style={styles.infoCafeteria} numberOfLines={1}>
            {cafeteria?.nombre || 'la cafetería seleccionada'}
          </Text>
          <Text style={styles.infoCount}>
            {connected
              ? productosSummary(disponibles, productosFiltrados.length)
              : 'Conectando…'}
          </Text>
        </Card>
      </View>

      {/* FR-07: filtro por categoría, solo si hay más de una categoría */}
      {categories.length > 1 && (
        <CategoryFilter
          categories={categories}
          selected={categoriaActiva}
          onSelect={setCategoriaActiva}
          totalProducts={products.length}
        />
      )}

      {/* FR-15: buscador de texto con debounce, combinado con la categoría */}
      <View style={styles.searchRow}>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar producto…"
          placeholderTextColor={colors.textoDeshabilitado}
          style={styles.searchInput}
          accessibilityLabel="Buscar producto"
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FR-15: ordenamiento por precio o nombre, con el criterio visible */}
      <View style={styles.ordenRow}>
        <Text style={styles.ordenLabel}>Orden: {ORDEN_LABELS[orden]}</Text>
        <View style={styles.ordenChips}>
          {OPCIONES_ORDEN.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.ordenChip, orden === o.value && styles.ordenChipActivo]}
              onPress={() => setOrden(o.value)}
            >
              <Text style={[styles.ordenChipText, orden === o.value && styles.ordenChipTextActivo]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderBody()}

      {/* FR-08: el detalle se superpone al menú, así que la cafetería
          seleccionada y el filtro de categoría se mantienen al cerrarlo. */}
      {productoDetalle && (
        <View style={styles.detailOverlay}>
          <ProductDetail
            product={productoDetalle}
            cafeteriaName={cafeteria?.nombre}
            onAdd={handleAdd}
            onClose={() => setProductoDetalle(null)}
          />
        </View>
      )}
    </View>
  );
};

const OPCIONES_ORDEN = [
  { value: 'precio_asc', label: 'Precio ↑' },
  { value: 'precio_desc', label: 'Precio ↓' },
  { value: 'nombre_asc', label: 'Nombre A-Z' },
  { value: 'nombre_desc', label: 'Nombre Z-A' },
];

const ORDEN_LABELS = {
  precio_asc: 'Precio: de menor a mayor',
  precio_desc: 'Precio: de mayor a menor',
  nombre_asc: 'Nombre: A a la Z',
  nombre_desc: 'Nombre: Z a la A',
};

const productosSummary = (disponibles, total) => {
  if (total === 0) return 'Sin productos';
  if (disponibles === total) return `${total} producto${total === 1 ? '' : 's'}`;
  return `${disponibles} de ${total} disponibles`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },

  // Capa del detalle: cubre el menú sin desmontarlo, por eso la cafetería
  // seleccionada y el filtro se conservan al cerrar.
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fondo,
  },

  header: {
    backgroundColor: colors.blanco,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.sm,
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
    color: colors.cafeOscuro,
    lineHeight: 32,
  },

  title: {
    fontSize: 18,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },

  headerIcon: {
    position: 'absolute',
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.cafeOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconText: {
    color: colors.blanco,
    fontSize: typography.cuerpo,
  },

  infoCard: {
    marginTop: 10,
    backgroundColor: colors.crema,
    borderRadius: 14,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },

  // Indicador de que la suscripción en vivo está activa (FR-10)
  liveDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  liveDotOn: {
    backgroundColor: colors.verde,
  },

  liveDotOff: {
    backgroundColor: colors.dorado,
  },

  infoCafeteria: {
    color: colors.cafeOscuro,
    fontSize: 13,
    fontWeight: typography.pesoBold,
    textAlign: 'center',
  },

  infoCount: {
    color: colors.textoSecundario,
    fontSize: 11,
    fontWeight: typography.pesoMedio,
    marginTop: 2,
  },

  // FR-15: búsqueda
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borde,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.cuerpoPequeno,
    color: colors.cafeOscuro,
  },
  searchClear: {
    padding: spacing.sm,
  },
  searchClearText: {
    fontSize: 16,
    color: colors.textoSecundario,
  },

  // FR-15: orden
  ordenRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  ordenLabel: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
    marginBottom: spacing.xs,
  },
  ordenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ordenChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borde,
    backgroundColor: colors.blanco,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  ordenChipActivo: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },
  ordenChipText: {
    fontSize: typography.etiqueta,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoMedio,
  },
  ordenChipTextActivo: {
    color: colors.blanco,
  },

  loader: {
    marginTop: 48,
  },

  // El FlatList necesita flex:1 explícito. Cuando el filtro de categorías se
  // agregó como hermano dentro del contenedor, sin esto la lista quedaba con
  // altura 0 y no se veían los productos.
  listFlex: {
    flex: 1,
  },

  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  categorySection: {
    marginBottom: spacing.sm,
  },

  categoryTitle: {
    alignSelf: 'center',
    backgroundColor: colors.blanco,
    color: colors.cafeOscuro,
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
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
    marginBottom: spacing.lg,
  },

  stateTitle: {
    fontSize: 18,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    textAlign: 'center',
  },

  stateText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});

export default MenuScreen;