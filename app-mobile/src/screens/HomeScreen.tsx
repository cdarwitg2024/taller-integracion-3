import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface HomeScreenProps {
  user?: User | null;
}

export const HomeScreen = ({ user }: HomeScreenProps) => {
  const [loading, setLoading] = useState(false);

  // Obtener nombre del estudiante de la metadata de Supabase
  const studentName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Estudiante';
  const studentEmail = user?.email || '';

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir de CoffeeFast?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const { error } = await supabase.auth.signOut();
          setLoading(false);
          if (error) {
            Alert.alert('Error', 'No se pudo cerrar la sesión: ' + error.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandGroup}>
          <Text style={styles.logoIcon}>☕</Text>
          <Text style={styles.brandTitle}>CoffeeFast</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutIconButton}
          onPress={handleLogout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#E07A5F" />
          ) : (
            <Text style={styles.logoutIconText}>🚪 Salir</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎓 SESIÓN ACTIVA UCT</Text>
          </View>
          <Text style={styles.welcomeTitle}>¡Hola, {studentName}!</Text>
          <Text style={styles.userEmail}>{studentEmail}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>📱 Catálogo de Cafetería</Text>
          <Text style={styles.infoBoxText}>
            Próximamente podrás realizar tus pedidos en línea sin hacer filas en el campus.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loading}
        >
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DD',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 20,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C2A21',
    fontFamily: 'serif',
  },
  logoutIconButton: {
    backgroundColor: '#F5EBE1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  logoutIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C6D58',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#3C2A21',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#3C2A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FAF7F2',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#D0C5B8',
  },
  infoBox: {
    backgroundColor: '#F3EDE6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#8A7A70',
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: '#E07A5F',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});