import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

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
    <View style={styles.card}>
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
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => onSelectCafeteria?.(item)}
        accessibilityLabel={`Ver el menú de ${item.nombre}`}
      >
        <Text style={styles.menuButtonText}>Ver Menu</Text>
      </TouchableOpacity>
    </View>
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
            tintColor="#4A2E2B"
            colors={['#4A2E2B']}
          />
        }
      >
        {/* Banner Informativo Superior */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Podras ver las cafeterias disponibles en este menu
          </Text>
        </View>

        {/* Lista de Cafeterías */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#4A2E2B" />
            <Text style={styles.loadingText}>Cargando cafeterías…</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorStateIcon}>📡</Text>
            <Text style={styles.errorStateTitle}>Sin conexión con el servidor</Text>
            <Text style={styles.errorStateText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchCafeterias()}
              activeOpacity={0.85}
              accessibilityLabel="Reintentar la carga de cafeterías"
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : cafeterias.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>☕</Text>
            <Text style={styles.emptyStateTitle}>Aún no hay cafeterías disponibles</Text>
            <Text style={styles.emptyStateText}>
              No hay cafeterías activas registradas en este momento. Vuelve más tarde para ver
              el menú del campus.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchCafeterias()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Actualizar</Text>
            </TouchableOpacity>
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
        <View style={styles.bottomBanner}>
          <Text style={styles.bottomBannerText}>
            Si no encuentras una cafeteria que te guste puedes pasar a ver directamente los menus
            disponibles y se filtrara automaticamente a una cafeteria con este disponible
          </Text>
        </View>
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
  if (typeof minutos !== 'number' || Number.isNaN(minutos)) return { color: '#8C7A70' };
  if (minutos <= 5) return { color: '#5B8C51' };
  if (minutos <= 15) return { color: '#B58A29' };
  return { color: '#A92A2A' };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3B2319',
    fontFamily: 'serif',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#4A2E2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBanner: {
    backgroundColor: '#F5ECE5',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  infoBannerText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#4A2E2B',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0E8E1',
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#EAEAEA',
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5ECE5',
  },
  cardImageFallbackIcon: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B2319',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8C7A70',
    marginVertical: 2,
  },
  cardDelay: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C026D3',
    marginTop: 2,
  },
  menuButton: {
    backgroundColor: '#F5ECE5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  menuButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B2319',
  },
  bottomBanner: {
    backgroundColor: '#F9F3EC',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
  },
  bottomBannerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#7A685D',
    lineHeight: 16,
  },
  emptyState: {
    marginTop: 40,
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#F9F3EC',
    borderRadius: 24,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B2319',
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 12,
    color: '#7A685D',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  loadingState: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#8C7A70',
    fontWeight: '600',
  },
  errorState: {
    marginTop: 40,
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#FCEEEE',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F2D4D4',
  },
  errorStateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8A2F2F',
    textAlign: 'center',
  },
  errorStateText: {
    fontSize: 12,
    color: '#7A4A4A',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4A2E2B',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});