import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { CafeteriaListScreen } from './src/screens/CafeteriaListScreen';
import { Cafeteria } from './src/types/cafeteria';

type CafeteriaListProps = {
  selectedCafeteriaId?: Cafeteria['id'];
  onSelectCafeteria: (cafeteria: Cafeteria) => void;
};

const CafeteriaListWithProps = CafeteriaListScreen as React.ComponentType<CafeteriaListProps>;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');
  
  // AGREGADO: Estado para controlar si el usuario entra como invitado
  const [isGuest, setIsGuest] = useState(false);

  // Guardar temporalmente la cafetería seleccionada (FR-05)
  const [selectedCafeteria, setSelectedCafeteria] = useState<Cafeteria | null>(null);

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

  const handleLogout = async () => {
    Alert.alert(
      isGuest ? 'Salir de Invitado' : 'Cerrar Sesión',
      '¿Deseas salir a la pantalla de inicio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            setSelectedCafeteria(null);
            if (isGuest) {
              setIsGuest(false); // Resetear modo invitado
            } else {
              await supabase.auth.signOut();
            }
          },
        },
      ]
    );
  };

  const handleSelectCafeteria = (cafeteria: Cafeteria) => {
    setSelectedCafeteria(cafeteria);
    Alert.alert(
      'Cafetería Seleccionada',
      `Has elegido: ${cafeteria.nombre}`
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A3728" />
      </View>
    );
  }

  // MODIFICADO: Permite el paso si hay sesión activa O si es un invitado
  const isUserAllowed = (session && session.user) || isGuest;

  return (
    <SafeAreaProvider>
      {isUserAllowed ? (
        <View style={{ flex: 1 }}>
          {/* Barra superior con opción de salir */}
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <Text style={styles.topBarTitle}>
              ☕ CoffeeFast {isGuest ? '(Invitado)' : ''}
            </Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Salir</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Listado de Cafeterías del Campus */}
          <CafeteriaListWithProps
            selectedCafeteriaId={selectedCafeteria?.id}
            onSelectCafeteria={handleSelectCafeteria}
          />
        </View>
      ) : currentScreen === 'login' ? (
        /* MODIFICADO: Se pasa la función onExploreAsGuest al LoginScreen */
        <LoginScreen 
          onNavigateToRegister={() => setCurrentScreen('register')} 
          onExploreAsGuest={() => setIsGuest(true)}
        />
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
  topBar: {
    backgroundColor: '#FAF7F2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DD',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A3728',
  },
  logoutBtn: {
    backgroundColor: '#F5EBE1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C6D58',
  },
});