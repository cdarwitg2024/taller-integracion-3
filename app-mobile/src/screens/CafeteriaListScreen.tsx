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

export const CafeteriaListScreen = () => {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCafeterias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('cafeterias').select('*');
      if (error) throw error;
      setCafeterias(data || []);
    } catch (err) {
      console.error(err);
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
      <TouchableOpacity style={styles.menuButton}>
        <Text style={styles.menuButtonText}>Ver Menu</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado */}
      <View style={styles.topHeader}>
        <View style={{ width: 36 }} />
        <Text style={styles.welcomeText}>Bienvenido Usuario</Text>
        <TouchableOpacity style={styles.iconBadge}>
          <Text style={{ fontSize: 18 }}>☕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Banner Informativo Superior */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Podras ver las cafeterias disponibles en este menu
          </Text>
        </View>

        {/* Lista de Cafeterías */}
        {loading ? (
          <ActivityIndicator size="large" color="#4A2E2B" style={{ marginTop: 40 }} />
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

      {/* Barra de Navegación Inferior */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>☕</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Menú</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💼</Text>
          <Text style={styles.navText}>Carrito</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>
      </View>
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
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0E8E1',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
  },
  navText: {
    fontSize: 10,
    color: '#9C8A80',
    marginTop: 2,
  },
  navTextActive: {
    color: '#3B2319',
    fontWeight: '700',
  },
});