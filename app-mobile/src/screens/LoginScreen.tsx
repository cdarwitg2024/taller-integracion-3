import React, { useState } from 'react';
import {
  Alert,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { authEmailRedirectTo } from '../lib/authRedirect';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const logo = require('../../assets/icon.png');

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onExploreAsGuest?: () => void;
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
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Correo requerido',
        'Ingresa tu correo institucional en el campo superior para reenviarte el enlace de confirmación.'
      );
      return;
    }

    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: authEmailRedirectTo,
        },
      });

      if (error) {
        Alert.alert('No fue posible reenviar', error.message);
      } else {
        Alert.alert(
          '¡Correo de confirmación enviado!',
          `Hemos reenviado el enlace a ${email.trim().toLowerCase()}. Por favor revisa tu bandeja de entrada o spam para activar tu cuenta.`
        );
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un problema al solicitar el reenvío de confirmación.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setShowResendConfirmation(false);
        setErrorMessage('Correo o contraseña incorrectos.');
      } else if (error.message.includes('Email not confirmed')) {
        setShowResendConfirmation(true);
        setErrorMessage('Tu correo institucional aún no ha sido confirmado.');
      } else {
        setShowResendConfirmation(false);
        setErrorMessage(error.message);
      }
    } else {
      setShowResendConfirmation(false);
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

          {/* Alerta de Error y Reenvío de Confirmación */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              {showResendConfirmation && (
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResendConfirmation}
                  disabled={resendingEmail}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resendBtnText}>
                    {resendingEmail ? 'Reenviando correo...' : 'Reenviar enlace de confirmación'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Tarjeta del Formulario */}
          <Card variant="elevated" padding="lg">
            {/* Campo: Correo Institucional */}
            <Input
              label="Correo Institucional"
              placeholder="tunombre@alu.uct.cl"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Campo: Contraseña */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Contraseña</Text>
                {onForgotPassword && (
                  <TouchableOpacity
                    onPress={onForgotPassword}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="¿Olvidaste tu contraseña?"
                  >
                    <Text style={styles.forgotPassword}>¿La olvidaste?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textoDeshabilitado}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="password"
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
              <Text style={styles.hintText}>Mínimo 8 caracteres</Text>
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
            <Button
              title="Iniciar sesión"
              onPress={handleLogin}
              loading={loading}
              size="lg"
            />

            {/* Divisor */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O TAMBIÉN</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botón Invitado */}
            {onExploreAsGuest && (
              <Button
                title="Explorar Carta como Invitado"
                onPress={onExploreAsGuest}
                variant="secondary"
                size="md"
              />
            )}
          </Card>

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
    backgroundColor: colors.fondo,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: colors.crema,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.cafeMedio,
    letterSpacing: 0.5,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.tituloGrande,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: colors.rojoBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.rojo,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    lineHeight: 18,
  },
  resendBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.cafeOscuro,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resendBtnText: {
    color: colors.textoBlanco,
    fontSize: typography.micro,
    fontWeight: typography.pesoBold,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  forgotPassword: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: '#E07A5F',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fondo,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  input: {
    flex: 1,
    fontSize: typography.cuerpo,
    color: colors.cafeOscuro,
  },
  eyeIcon: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
  },
  eyeIconText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
    color: '#E07A5F',
  },
  hintText: {
    fontSize: typography.micro,
    color: colors.textoDeshabilitado,
    marginTop: spacing.xs,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textoDeshabilitado,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },
  checkmark: {
    color: colors.textoBlanco,
    fontSize: typography.cuerpoPequeno,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borde,
  },
  dividerText: {
    fontSize: typography.micro,
    fontWeight: typography.pesoBold,
    color: colors.cafeClaro,
    paddingHorizontal: spacing.md,
    letterSpacing: 0.5,
  },
  footerNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  footerLink: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    textDecorationLine: 'underline',
  },
  securityFooter: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  securityText: {
    fontSize: typography.micro,
    color: colors.textoDeshabilitado,
  },
});

export default LoginScreen;
