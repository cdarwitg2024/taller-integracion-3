import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const logo = require('../../assets/icon.png');

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onExploreAsGuest?: () => void;
  // FR-04: abre la pantalla de recuperación de contraseña
  onForgotPassword?: () => void;
}

export const LoginScreen = ({
  onNavigateToRegister,
  onExploreAsGuest,
  onForgotPassword,
}: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMessage('Correo o contraseña incorrectos.');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMessage('Tu correo aún no ha sido confirmado.');
      } else {
        setErrorMessage(error.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge Superior */}
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PORTAL ESTUDIANTES • UCT</Text>
            </View>
          </View>

          {/* Logo e Identidad */}
          <View style={styles.header}>
            <Image source={logo} style={styles.logoImage} accessibilityIgnoresInvertColors />
            <Text style={styles.brandName}>CoffeeFast</Text>
            <Text style={styles.title}>Iniciar Sesión</Text>
            <Text style={styles.subtitle}>
              Pide tu café entre clases y retira sin esperas ni filas
            </Text>
          </View>

          {/* Alerta de Error */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Tarjeta del Formulario */}
          <View style={styles.card}>
            {/* Campo: Correo Institucional */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Correo Institucional</Text>
                <Text style={styles.domainHint}>alu.uct.cl</Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="tunombre@alu.uct.cl"
                  placeholderTextColor="#BBB3A8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Campo: Contraseña */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Contraseña</Text>
                {/* FR-04: antes era un TouchableOpacity sin onPress */}
                <TouchableOpacity
                  onPress={onForgotPassword}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="¿Olvidaste tu contraseña?"
                >
                  <Text style={styles.forgotPassword}>¿La olvidaste?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#BBB3A8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  <Text style={styles.eyeIconText}>
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>Mínimo 8 caracteres</Text>
              </View>
            </View>

            {/* Checkbox: Recordar Sesión */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Recordar sesión en este dispositivo</Text>
            </TouchableOpacity>

            {/* Botón Principal */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>

            {/* Divisor */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O TAMBIÉN</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botón Invitado */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={onExploreAsGuest}
              activeOpacity={0.8}
            >
              <Text style={styles.guestButtonText}>Explorar Carta como Invitado</Text>
            </TouchableOpacity>
          </View>

          {/* Footer de Registro */}
          <View style={styles.footerNav}>
            <Text style={styles.footerText}>¿No tienes cuenta? </Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={styles.footerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Seguridad */}
          <View style={styles.securityFooter}>
            <Text style={styles.securityText}>
              Conexión segura vía Red Campus UCT
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#F3E9E0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E5544',
    letterSpacing: 0.5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C2A21',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2C1E16',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A7A70',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE8E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#D93025',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#3C2A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C2A21',
  },
  domainHint: {
    fontSize: 12,
    color: '#9C8E85',
  },
  forgotPassword: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E07A5F',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#2C1E16',
  },
  eyeIcon: {
    paddingVertical: 6,
    paddingLeft: 8,
  },
  eyeIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E07A5F',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  hintText: {
    fontSize: 11,
    color: '#9C8E85',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9C8E85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5C4033',
    borderColor: '#5C4033',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#7A6B63',
  },
  submitButton: {
    backgroundColor: '#4A3728',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A3728',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EFE8E1',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B5A89E',
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  guestButton: {
    backgroundColor: '#F7F4F0',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#4A3728',
    fontSize: 14,
    fontWeight: '700',
  },
  footerNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#8A7A70',
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C2A21',
    textDecorationLine: 'underline',
  },
  securityFooter: {
    alignItems: 'center',
    marginTop: 16,
  },
  securityText: {
    fontSize: 10,
    color: '#A89B91',
  },
});
