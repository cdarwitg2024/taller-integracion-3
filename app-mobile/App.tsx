import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';

// HomeScreen inline para garantizar resolucion de export/import
const HomeScreenInternal = ({ user }: { user: User }) => {
  const studentName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante';

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Deseas salir de CoffeeFast?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.homeContainer}>
      <Text style={styles.homeTitle}>¡Hola, {studentName}!</Text>
      <Text style={styles.homeSubtitle}>{user.email}</Text>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A3728" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {session && session.user ? (
        <HomeScreenInternal user={session.user} />
      ) : currentScreen === 'login' ? (
        <LoginScreen onNavigateToRegister={() => setCurrentScreen('register')} />
      ) : (
        <RegisterScreen onNavigateToLogin={() => setCurrentScreen('login')} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    padding: 24,
  },
  homeLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A3728',
    marginBottom: 16,
  },
  homeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C1E16',
    textAlign: 'center',
  },
  homeSubtitle: {
    fontSize: 14,
    color: '#8A7A70',
    marginBottom: 32,
  },
  logoutBtn: {
    backgroundColor: '#E07A5F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
  },
  logoutBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});