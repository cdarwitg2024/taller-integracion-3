import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

interface Cafeteria {
  id: string;
  nombre: string;
  ubicacion: string;
  demora?: string;
  rating?: string;
  imagen_url?: string;
}

const FALLBACK_CAFETERIAS: Cafeteria[] = [
  {
    id: 'mock-1',
    nombre: 'Cafetería Central',
    ubicacion: 'Edificio de Ingeniería • Campus Central',
    demora: '1 - 3m',
    rating: '4.5/5.0',
    imagen_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
  },
  {
    id: 'mock-2',
    nombre: 'Cafetería Biblioteca',
    ubicacion: 'Biblioteca General • Campus Central',
    demora: '2 - 4m',
    rating: '4.7/5.0',
    imagen_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500',
  },
  {
    id: 'mock-3',
    nombre: 'Cafetería Medicina',
    ubicacion: 'Facultad de Medicina',
    demora: '3 - 5m',
    rating: '4.2/5.0',
    imagen_url: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=500',
  },
  {
    id: 'mock-4',
    nombre: 'Cafetería Economía',
    ubicacion: 'Edificio de Economía',
    demora: '1 - 2m',
    rating: '4.6/5.0',
    imagen_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500',
  },
];

export const CafeteriaListScreen = ({
  serverUserName,
  onSelectCafeteria,
}: {
  serverUserName?: string;
  onSelectCafeteria?: (cafeteria: Cafeteria) => void;
}) => {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCafeterias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cafeterias')
        .select('*')
        .eq('activa', true);
if (error) throw error;
        // Si no hay cafeterías registradas o no se pueden leer (ej. política RLS),
        // se muestra el catálogo de demostración
        setCafeterias(data && data.length > 0 ? data : FALLBACK_CAFETERIAS);
      } catch (err) {
        console.warn('No se pudieron cargar las cafeterías, usando datos de demostración:', (err as Error).message);
        setCafeterias(FALLBACK_CAFETERIAS);
      } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCafeterias();
  }, []);

  const renderCafeteriaCard = ({ item }: { item: Cafeteria }) => (
    <View style={styles.card}>
      <Image
        source={{
          uri: item.imagen_url || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
        }}
        style={styles.cardImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardSubtitle}>{item.ubicacion}</Text>
        <Text style={[styles.cardDelay, getDelayStyle(item.demora)]}>
          {item.demora || 'Demora de 1 - 3m'}
        </Text>
        <Text style={styles.cardRating}>{item.rating || '4.5/5.0'}</Text>
      </View>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => onSelectCafeteria?.(item)}
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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Banner Informativo Superior */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Podras ver las cafeterias disponibles en este menu
          </Text>
        </View>

        {/* Lista de Cafeterías */}
        {loading ? (
          <ActivityIndicator size="large" color="#4A2E2B" style={{ marginTop: 40 }} />
        ) : cafeterias.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>☕</Text>
            <Text style={styles.emptyStateTitle}>Aún no hay cafeterías disponibles</Text>
            <Text style={styles.emptyStateText}>
              Por ahora no hay cafeterías activas. Vuelve más tarde para ver el menú del campus.
            </Text>
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

const getDelayStyle = (demora?: string) => {
  if (!demora) return { color: '#B58A29' };
  if (demora.includes('0 - 1') || demora.includes('1 - 2')) return { color: '#B58A29' };
  if (demora.includes('7 - 10')) return { color: '#A92A2A' };
  return { color: '#5B8C51' };
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
});