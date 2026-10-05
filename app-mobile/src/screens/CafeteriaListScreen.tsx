import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface Cafeteria {
  /**
   * En la base `cafeterias.id` es un bigint. Antes este tipo decía `string` y
   * el catálogo de demostración usaba ids de texto ('mock-1'), que al pasarse
   * a la consulta del menú noaban contra la columna numérica.
   */
  id: number;
  nombre: string;
  descripcion?: string;
  hora_apertura?: string;
  hora_cierre?: string;
  imagen_url?: string;
  /** Minutos de preparación base. Es el dato real de demora en la base. */
  tiempo_base_min?: number;
}

/** Imagen de relleno cuando la cafetería no tiene foto o la URL está caída. */
const IMAGEN_DEFAULT =
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500';

export const CafeteriaListScreen = ({
  serverUserName,
  onSelectCafeteria,
}: {
  serverUserName?: string;
  onSelectCafeteria?: (cafeteria: Cafeteria) => void;
}) => {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Ids cuya imagen falló, para no reintentar la misma URL rota. */
  const [imagenesCaidas, setImagenesCaidas] = useState<Record<number, boolean>>({});

  /**
   * Traduce el error de Supabase a un mensaje que el usuario pueda entender.
   * No mostramos el texto crudo porque puede ser un código de Postgres.
   */
  const mensajeDeError = (err: unknown): string => {
    const texto = err instanceof Error ? err.message : String(err ?? '');

    if (/fetch|network|timeout|ENOTFOUND|ECONN/i.test(texto)) {
      return 'No pudimos conectarnos con el servidor. Revisa tu conexión a internet.';
    }
    if (/timeout/i.test(texto)) {
      return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
    }
    if (/JWT|auth|RLS|row-level|permission/i.test(texto)) {
      return 'Tu sesión no tiene permiso para ver el catálogo. Cierra sesión e intenta otra vez.';
    }
    return 'No pudimos cargar las cafeterías. Intenta de nuevo en un momento.';
  };

  const fetchCafeterias = useCallback(async (esRefresh = false) => {
    if (esRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('cafeterias')
        .select('*')
        .eq('activa', true);

      if (error) throw error;

      setCafeterias((data as Cafeteria[]) ?? []);
    } catch (err) {
      // No inventamos datos: mostrar cafeterías falsas hacía que el usuario
      // tocara una cafetería que no existe y el menú nunca cargaba.
      setCafeterias([]);
      setErrorMessage(mensajeDeError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCafeterias();
  }, [fetchCafeterias]);

  const renderCafeteriaCard = ({ item }: { item: Cafeteria }) => (
    <Card variant="elevated" padding="md" style={styles.card}>
      {imagenesCaidas[item.id] || !item.imagen_url ? (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Text style={styles.cardImageFallbackIcon}>☕</Text>
        </View>
      ) : (
        <Image
          source={{ uri: item.imagen_url }}
          style={styles.cardImage}
          // Una URL caída dejaba un hueco gris sin explicación.
          onError={() => setImagenesCaidas((prev) => ({ ...prev, [item.id]: true }))}
        />
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {item.descripcion || 'Sin descripción'}
        </Text>
        {/*
          Antes la tarjeta imprimía "Demora de 1 - 3m" y "4.5/5.0" fijos.
          Ninguna de las dos columnas existe en la tabla `cafeterias`, así que
          eran datos inventados. Ahora sale de `tiempo_base_min` y
          `hora_cierre`, que sí están.
        */}
        <Text style={[styles.cardDelay, getDelayStyle(item.tiempo_base_min)]}>
          {formatearDemora(item.tiempo_base_min)}
        </Text>
        <Text style={styles.cardRating}>
          {item.hora_cierre ? `Cierra ${recortarHora(item.hora_cierre)}` : 'Sin horario'}
        </Text>
      </View>
      <Button
        title="Ver Menu"
        variant="secondary"
        size="sm"
        onPress={() => onSelectCafeteria?.(item)}
      />
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado */}
      <View style={styles.topHeader}>
        <View style={{ width: 36 }} />
        <Text style={styles.welcomeText}>Bienvenido {serverUserName || 'Usuario'}</Text>
        <View style={styles.iconBadge}>
          <Text style={{ fontSize: 18 }}>☕</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCafeterias(true)}
            tintColor={colors.cafeOscuro}
            colors={[colors.cafeOscuro]}
          />
        }
      >
        {/* Banner Informativo Superior */}
        <Card variant="elevated" padding="lg" style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Podras ver las cafeterias disponibles en este menu
          </Text>
        </Card>

        {/* Lista de Cafeterías */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.cafeOscuro} />
            <Text style={styles.loadingText}>Cargando cafeterías…</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorStateIcon}>📡</Text>
            <Text style={styles.errorStateTitle}>Sin conexión con el servidor</Text>
            <Text style={styles.errorStateText}>{errorMessage}</Text>
            <View style={styles.retryButtonWrapper}>
              <Button
                title="Reintentar"
                onPress={() => fetchCafeterias()}
              />
            </View>
          </View>
        ) : cafeterias.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>☕</Text>
            <Text style={styles.emptyStateTitle}>Aún no hay cafeterías disponibles</Text>
            <Text style={styles.emptyStateText}>
              No hay cafeterías activas registradas en este momento. Vuelve más tarde para ver
              el menú del campus.
            </Text>
            <View style={styles.retryButtonWrapper}>
              <Button
                title="Actualizar"
                onPress={() => fetchCafeterias()}
              />
            </View>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {cafeterias.map((item) => (
              <React.Fragment key={item.id}>
                {renderCafeteriaCard({ item })}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Banner Informativo Inferior */}
        <Card variant="elevated" padding="lg" style={styles.bottomBanner}>
          <Text style={styles.bottomBannerText}>
            Si no encuentras una cafeteria que te guste puedes pasar a ver directamente los menus
            disponibles y se filtrara automaticamente a una cafeteria con este disponible
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * `tiempo_base_min` viene de la base. Si no está, no inventamos un rango:
 * mostramos que no hay dato.
 */
const formatearDemora = (minutos?: number) => {
  if (typeof minutos !== 'number' || Number.isNaN(minutos)) {
    return 'Sin tiempo estimado';
  }
  return `Listo en ~${minutos} min`;
};

/** Postgres devuelve la hora como 'HH:MM:SS'. Nos interesa HH:MM. */
const recortarHora = (hora: string) => hora.slice(0, 5);

const getDelayStyle = (minutos?: number) => {
  if (typeof minutos !== 'number' || Number.isNaN(minutos)) return { color: colors.textoSecundario };
  if (minutos <= 5) return { color: colors.verde };
  if (minutos <= 15) return { color: colors.naranja };
  return { color: colors.rojo };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blanco,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBanner: {
    backgroundColor: colors.crema,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
    borderRadius: 20,
  },
  infoBannerText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: colors.borde,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.crema,
  },
  cardImageFallbackIcon: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  cardSubtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginVertical: 2,
  },
  cardDelay: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    marginTop: spacing.xs,
  },
  cardRating: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
    marginTop: 2,
  },
  bottomBanner: {
    backgroundColor: colors.crema,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    borderRadius: 20,
  },
  bottomBannerText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textoSecundario,
    lineHeight: 16,
  },
  emptyState: {
    marginTop: 40,
    marginHorizontal: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.crema,
    borderRadius: 24,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  loadingState: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textoSecundario,
    fontWeight: typography.pesoMedio,
  },
  errorState: {
    marginTop: 40,
    marginHorizontal: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.rojoBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.rojo,
  },
  errorStateIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  errorStateTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
    color: colors.rojo,
    textAlign: 'center',
  },
  errorStateText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  retryButtonWrapper: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
    width: '100%',
  },
});
