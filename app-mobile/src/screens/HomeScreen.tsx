import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export const HomeScreen = () => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>☕</Text>
        <Text style={styles.title}>¡Bienvenido a CoffeeFast!</Text>
        <Text style={styles.subtitle}>Has iniciado sesión correctamente como estudiante.</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C1E16',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 14,
    color: '#8A7A70',
    textAlign: 'center',
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#E07A5F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});