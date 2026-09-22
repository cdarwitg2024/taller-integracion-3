import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export const RegisterScreen = () => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateInputs = (): boolean => {
    setErrorMessage(null);

    if (!nombreCompleto.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Por favor completa todos los campos.');
      return false;
    }

    // Validar formato de correo institucional @alu.uct.cl
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed.endsWith('@alu.uct.cl')) {
      setErrorMessage('Debes utilizar tu correo institucional (@alu.uct.cl).');
      return false;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return false;
    }

    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar los términos de uso y políticas.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    setLoading(true);

    // Separar Nombre y Apellido
    const parts = nombreCompleto.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: nombreCompleto.trim(),
            role: 'student',
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setErrorMessage('Este correo ya se encuentra registrado.');
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (data.user) {
        Alert.alert(
          '¡Registro exitoso!',
          'Tu cuenta ha sido creada correctamente. Ahora puedes iniciar sesión.',
          [
            {
              text: 'OK',
              onPress: () => {
                setNombreCompleto('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setAcceptedTerms(false);
                setErrorMessage(null);
              },
            },
          ]
        );
      }
    } catch (err: any) {
      setErrorMessage('Ocurrió un error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Encabezado Superior / Brand */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
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
        <Text style={styles.title}>Crear Cuenta</Text>
        <Text style={styles.subtitle}>
          Regístrate con tu correo institucional para pedir sin filas en el campus
        </Text>

        {/* Caja de Error */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Formulario */}
        <View style={styles.form}>
          {/* Nombre Completo */}
          <Text style={styles.label}>NOMBRE COMPLETO</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Francisca Morales"
              placeholderTextColor="#A09A93"
              value={nombreCompleto}
              onChangeText={setNombreCompleto}
              autoCapitalize="words"
            />
          </View>

          {/* Correo Institucional */}
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
          <Text style={styles.helperText}>🎯 Solo correos @alu.uct.cl</Text>

          {/* Contraseña */}
          <Text style={styles.label}>CONTRASEÑA</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor="#A09A93"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirmar Contraseña */}
          <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>➕</Text>
            <TextInput
              style={styles.input}
              placeholder="Repite tu contraseña"
              placeholderTextColor="#A09A93"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {/* Checkbox Términos */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              Acepto los <Text style={styles.termsBold}>términos de uso</Text> y políticas de la red del campus
            </Text>
          </TouchableOpacity>

          {/* Botón de Registro */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Registrarme</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Enlace Login */}
          <TouchableOpacity style={styles.loginLink}>
            <Text style={styles.loginText}>
              ¿Ya tienes cuenta? <Text style={styles.loginBold}>Inicia sesión aquí</Text>
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
    paddingVertical: 12,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: '#3C2A21',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    backgroundColor: '#3C2A21',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 14,
  },
  brandName: {
    fontSize: 18,
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
    marginBottom: 20,
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
    marginBottom: 6,
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
  helperText: {
    fontSize: 12,
    color: '#E07A5F',
    marginBottom: 12,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0C5B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#3C2A21',
    borderColor: '#3C2A21',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#8A7A70',
    lineHeight: 16,
  },
  termsBold: {
    fontWeight: '700',
    color: '#3C2A21',
  },
  button: {
    backgroundColor: '#4A3728',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  loginText: {
    fontSize: 13,
    color: '#8A7A70',
  },
  loginBold: {
    fontWeight: '700',
    color: '#3C2A21',
  },
});