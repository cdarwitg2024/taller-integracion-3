import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen = ({ onNavigateToRegister }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    // Validación básica de campos vacíos
    if (!email.trim() || !password) {
      setErrorMessage('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Credenciales incorrectas. Verifica tu correo o contraseña.');
        } else {
          setErrorMessage(error.message);
        }
      }
      // La redirección ocurrirá automáticamente en App.tsx vía onAuthStateChange
    } catch (err: any) {
      setErrorMessage('Ocurrió un error inesperado al intentar iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Encabezado Superior */}
        <View style={styles.topHeader}>
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>☕</Text>
            </View>
            <Text style={styles.brandName}>CoffeeFast</Text>
          </View>
        </View>

        {/* Badge Institucional */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🎓</Text>
            <Text style={styles.badgeText}>ACCESO ESTUDIANTIL UCT</Text>
          </View>
        </View>

        {/* Títulos */}
        <Text style={styles.title}>Iniciar Sesión</Text>
        <Text style={styles.subtitle}>
          Ingresa con tu correo institucional para realizar tus pedidos
        </Text>

        {/* Mensaje de Error */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Formulario */}
        <View style={styles.form}>
          {/* Correo */}
          <Text style={styles.label}>CORREO INSTITUCIONAL</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="tu.usuario@alu.uct.cl"
              placeholderTextColor="#A09A93"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Contraseña */}
          <Text style={styles.label}>CONTRASEÑA</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña"
              placeholderTextColor="#A09A93"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {/* Botón de Inicio de Sesión */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Ingresar</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Enlace para ir al Registro */}
          <TouchableOpacity style={styles.registerLink} onPress={onNavigateToRegister}>
            <Text style={styles.registerText}>
              ¿Aún no tienes cuenta? <Text style={styles.registerBold}>Regístrate aquí</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    backgroundColor: '#3C2A21',
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 16,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3C2A21',
    fontFamily: 'serif',
  },
  badgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EBE1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C6D58',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2C1E16',
    fontFamily: 'serif',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8A7A70',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE8E6',
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#A94442',
    fontSize: 13,
    flex: 1,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A4A42',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EDE6',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#2C1E16',
  },
  eyeIcon: {
    fontSize: 16,
    padding: 4,
    opacity: 0.6,
  },
  button: {
    backgroundColor: '#4A3728',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#4A3728',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9A8B80',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  registerText: {
    fontSize: 13,
    color: '#8A7A70',
  },
  registerBold: {
    fontWeight: '700',
    color: '#3C2A21',
  },
});