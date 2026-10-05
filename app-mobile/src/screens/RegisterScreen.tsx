import React, { useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const logo = require('../../assets/icon.png');

interface RegisterScreenProps {
  onNavigateToLogin?: () => void;
}

export const RegisterScreen = ({ onNavigateToLogin }: RegisterScreenProps) => {
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
            rol: 'estudiante',
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
                if (onNavigateToLogin) {
                  onNavigateToLogin();
                }
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
          <TouchableOpacity style={styles.backButton} onPress={onNavigateToLogin}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.brandContainer}>
            <Image source={logo} style={styles.logoBadge} accessibilityIgnoresInvertColors />
            <Text style={styles.brandName}>CoffeeFast</Text>
          </View>
        </View>

        {/* Badge Institucional */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
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
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Formulario */}
        <Card variant="elevated" padding="lg">
          {/* Nombre Completo */}
          <Input
            label="NOMBRE COMPLETO"
            placeholder="Ej. Francisca Morales"
            value={nombreCompleto}
            onChangeText={setNombreCompleto}
            autoCapitalize="words"
          />

          {/* Correo Institucional */}
          <Input
            label="CORREO INSTITUCIONAL"
            placeholder="tu.usuario@alu.uct.cl"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>Solo correos @alu.uct.cl</Text>

          {/* Contraseña */}
          <View>
            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={colors.textoDeshabilitado}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Text style={styles.eyeIconText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmar Contraseña */}
          <View>
            <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Repite tu contraseña"
                placeholderTextColor={colors.textoDeshabilitado}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'
                }
              >
                <Text style={styles.eyeIconText}>
                  {showConfirmPassword ? 'Ocultar' : 'Ver'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Checkbox Términos */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              Acepto los <Text style={styles.termsBold}>términos de uso</Text> y políticas de la red del campus
            </Text>
          </TouchableOpacity>

          {/* Botón de Registro */}
          <Button
            title="Registrarme"
            onPress={handleRegister}
            loading={loading}
            size="lg"
          />

          {/* Enlace Login */}
          <TouchableOpacity style={styles.loginLink} onPress={onNavigateToLogin}>
            <Text style={styles.loginText}>
              ¿Ya tienes cuenta? <Text style={styles.loginBold}>Inicia sesión aquí</Text>
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  scrollContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: spacing.xs,
  },
  backArrow: {
    fontSize: 22,
    color: colors.cafeOscuro,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
  },
  brandName: {
    fontSize: typography.subtitulo,
    fontWeight: '700',
    color: colors.cafeOscuro,
    fontFamily: 'serif',
  },
  badgeContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crema,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.cafeMedio,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.cafeOscuro,
    fontFamily: 'serif',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.cuerpo,
    color: colors.textoSecundario,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.rojoBg,
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: '#A94442',
    fontSize: typography.cuerpoPequeno,
    flex: 1,
  },
  label: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: '#5A4A42',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fondo,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    height: 52,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  input: {
    flex: 1,
    fontSize: typography.cuerpo,
    color: colors.cafeOscuro,
  },
  eyeIcon: {
    paddingLeft: spacing.sm,
  },
  eyeIconText: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: '#E07A5F',
  },
  helperText: {
    fontSize: typography.cuerpoPequeno,
    color: '#E07A5F',
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0C5B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.blanco,
  },
  checkboxChecked: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },
  checkmark: {
    color: colors.textoBlanco,
    fontSize: typography.cuerpoPequeno,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 16,
  },
  termsBold: {
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  loginText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  loginBold: {
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
});

export default RegisterScreen;
