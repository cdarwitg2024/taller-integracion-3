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
import Icon from '../components/Icon';
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

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handleResendConfirmation = async () => {
    if (!registeredEmail) return;

    setResendingEmail(true);
    setResendStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: {
          emailRedirectTo: 'coffeefast://auth/callback',
        },
      });

      if (error) {
        setResendStatus({ type: 'error', message: error.message });
      } else {
        setResendStatus({
          type: 'success',
          message: '¡Enlace reenviado! Revisa tu bandeja de entrada o spam.',
        });
      }
    } catch {
      setResendStatus({
        type: 'error',
        message: 'Ocurrió un problema al solicitar el reenvío de confirmación.',
      });
    } finally {
      setResendingEmail(false);
    }
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
          emailRedirectTo: 'coffeefast://auth/callback',
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
        // S2-T2: En Supabase con protección de enumeración de correos, si el correo
        // ya existe, GoTrue devuelve el usuario con identities = [] y no envía nuevo correo.
        if (data.user.identities && data.user.identities.length === 0) {
          setErrorMessage('Este correo institucional ya se encuentra registrado. Por favor inicia sesión.');
          return;
        }

        // Si Supabase requiere confirmación de correo (email confirmation activada),
        // no hay sesión activa inmediata (data.session === null).
        const pendingConfirmation = !data.session && !data.user.confirmed_at;

        if (pendingConfirmation) {
          // S2-T3: Mostrar estado visual dedicado "Revisa tu correo"
          setRegisteredEmail(email.trim().toLowerCase());
          setPassword('');
          setConfirmPassword('');
          setAcceptedTerms(false);
          setErrorMessage(null);
          setResendStatus(null);
        } else {
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
      }
    } catch (err: any) {
      setErrorMessage('Ocurrió un error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Encabezado Superior / Brand */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setRegisteredEmail(null);
                setResendStatus(null);
              }}
              accessibilityLabel="Volver al formulario de registro"
            >
              {/* S2-T3: icono vectorial en vez del glifo '←'. */}
              <Icon name="arrow-back" size={22} color={colors.cafeOscuro} />
            </TouchableOpacity>
            <View style={styles.brandContainer}>
              <Image source={logo} style={styles.logoBadge} accessibilityIgnoresInvertColors />
              <Text style={styles.brandName}>CoffeeFast</Text>
            </View>
          </View>

          {/* Badge Institucional */}
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>CONFIRMACIÓN PENDIENTE • UCT</Text>
            </View>
          </View>

          {/* Tarjeta Principal de Revisa tu Correo */}
          <Card variant="elevated" padding="lg">
            <View style={styles.iconCenterContainer}>
              <View style={styles.mailIconCircle}>
                <Text style={styles.mailEmoji}>✉️</Text>
              </View>
            </View>

            <Text style={styles.checkEmailTitle}>Revisa tu correo</Text>
            <Text style={styles.checkEmailSubtitle}>
              Hemos enviado un enlace de confirmación a tu cuenta institucional:
            </Text>

            <View style={styles.emailPill}>
              <Text style={styles.emailPillText}>{registeredEmail}</Text>
            </View>

            <View style={styles.stepsContainer}>
              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Abre tu bandeja de entrada institucional en <Text style={styles.boldText}>@alu.uct.cl</Text>.
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Busca el correo de <Text style={styles.boldText}>CoffeeFast</Text> (revisa también <Text style={styles.boldText}>Spam</Text>).
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Presiona el enlace de confirmación para activar tu acceso.
                </Text>
              </View>
            </View>

            {/* Ayuda para desarrollo local */}
            {__DEV__ && (
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>Entorno local de desarrollo</Text>
                <Text style={styles.devText}>
                  El correo se captura localmente en Mailpit:{'\n'}
                  http://127.0.0.1:54324
                </Text>
              </View>
            )}

            {/* Feedback de reenvío */}
            {resendStatus && (
              <View style={resendStatus.type === 'success' ? styles.successBox : styles.errorBox}>
                <Text style={resendStatus.type === 'success' ? styles.successText : styles.errorText}>
                  {resendStatus.message}
                </Text>
              </View>
            )}

            {/* Botón principal */}
            <Button
              title="Ya confirmé mi cuenta · Iniciar sesión"
              onPress={() => {
                setRegisteredEmail(null);
                setNombreCompleto('');
                setEmail('');
                if (onNavigateToLogin) {
                  onNavigateToLogin();
                }
              }}
              size="lg"
            />

            {/* Reenviar confirmación */}
            <Button
              title={resendingEmail ? 'Reenviando enlace...' : '¿No recibiste el correo? Reenviar'}
              onPress={handleResendConfirmation}
              variant="ghost"
              size="md"
              loading={resendingEmail}
              disabled={resendingEmail}
              style={{ marginTop: spacing.md }}
            />

            {/* Enlace para corregir correo o volver */}
            <TouchableOpacity
              style={styles.changeEmailLink}
              onPress={() => {
                setRegisteredEmail(null);
                setResendStatus(null);
              }}
            >
              <Text style={styles.changeEmailText}>
                ¿Correo equivocado? <Text style={styles.changeEmailBold}>Volver al formulario</Text>
              </Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Encabezado Superior / Brand */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onNavigateToLogin}
            accessibilityLabel="Volver al inicio de sesión"
          >
            {/* S2-T3: icono vectorial en vez del glifo '←'. */}
            <Icon name="arrow-back" size={22} color={colors.cafeOscuro} />
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
              {acceptedTerms && (
                // S2-T3: icono vectorial en vez del glifo '✓'.
                <Icon name="checkmark" size={15} color={colors.textoBlanco} />
              )}
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
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: colors.bordeError,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.textoError,
    fontSize: typography.cuerpoPequeno,
    flex: 1,
  },
  label: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.textoMarronOscuro,
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
    color: colors.acento,
  },
  helperText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.acento,
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
    borderColor: colors.bordeInput,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.blanco,
  },
  checkboxChecked: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
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
  iconCenterContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mailIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  mailEmoji: {
    fontSize: 32,
  },
  checkEmailTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.cafeOscuro,
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  checkEmailSubtitle: {
    fontSize: typography.cuerpo,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  emailPill: {
    backgroundColor: colors.fondo,
    borderColor: colors.bordeOscuro,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  emailPillText: {
    fontSize: typography.cuerpo,
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
  stepsContainer: {
    backgroundColor: colors.fondo,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: colors.textoBlanco,
    fontSize: typography.etiqueta,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
  devBox: {
    backgroundColor: colors.doradoBg,
    borderColor: colors.bordeDorado,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  devTitle: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.naranja,
    marginBottom: 2,
  },
  devText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 16,
  },
  successBox: {
    backgroundColor: colors.verdeBg,
    borderColor: colors.bordeExito,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.textoExito,
    fontSize: typography.cuerpoPequeno,
    textAlign: 'center',
  },
  changeEmailLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  changeEmailText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  changeEmailBold: {
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
});

export default RegisterScreen;
