import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';

// Componente HomeScreen incrustado directamente para evitar fallos de importación
const HomeScreen = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.homeContainer}>
      <Text style={styles.homeIcon}>☕</Text>
      <Text style={styles.homeTitle}>¡Bienvenido a CoffeeFast!</Text>
      <Text style={styles.homeSubtitle}>Sesión iniciada correctamente (FR-02)</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
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
      {session ? (
        <HomeScreen />
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
    paddingHorizontal: 24,
  },
  homeIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  homeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C1E16',
    marginBottom: 8,
  },
  homeSubtitle: {
    fontSize: 14,
    color: '#8A7A70',
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#4A3728',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});