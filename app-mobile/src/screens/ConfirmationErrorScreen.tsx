import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
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

export interface ConfirmationErrorScreenProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  errorInfo?: {
    title?: string;
    description?: string;
    code?: string;
  };
}

/**
 * Pantalla de manejo de enlaces de confirmación inválidos, expirados o ya utilizados (S2-T4).
 * Evita dejar al estudiante en una pantalla rota y le ofrece soluciones claras:
 * 1. Iniciar sesión directamente (si el enlace ya fue usado y la cuenta ya está activa).
 * 2. Reenviar un nuevo enlace de confirmación a su correo institucional (@alu.uct.cl).
 * 3. Volver al registro si ingresó un correo equivocado.
 */
export const ConfirmationErrorScreen = ({
  onNavigateToLogin,
  onNavigateToRegister,
  errorInfo,
}: ConfirmationErrorScreenProps) => {
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const displayTitle = errorInfo?.title || 'Enlace no disponible o expirado';
  const displayDescription =
    errorInfo?.description ||
    'El enlace de confirmación ha expirado por tiempo de seguridad, ya fue utilizado previamente o no es válido.';

  const handleResend = async () => {
    setResendStatus(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setResendStatus({
        type: 'error',
        message: 'Por favor ingresa tu correo institucional (@alu.uct.cl).',
      });
      return;
    }

    if (!trimmedEmail.endsWith('@alu.uct.cl')) {
      setResendStatus({
        type: 'error',
        message: 'Debes utilizar tu correo institucional de la universidad (@alu.uct.cl).',
      });
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: 'coffeefast://auth/callback',
        },
      });

      if (error) {
        setResendStatus({
          type: 'error',
          message: error.message || 'No fue posible reenviar el enlace. Intenta más tarde.',
        });
      } else {
        setResendStatus({
          type: 'success',
          message: `¡Nuevo enlace enviado a ${trimmedEmail}! Revisa tu bandeja de entrada o spam.`,
        });
      }
    } catch {
      setResendStatus({
        type: 'error',
        message: 'Ocurrió un error inesperado al solicitar el reenvío.',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Encabezado Superior / Brand */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onNavigateToLogin}
              accessibilityLabel="Volver al inicio de sesión"
            >
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
              <Text style={styles.badgeText}>ESTADO DE CONFIRMACIÓN • UCT</Text>
            </View>
          </View>

          {/* Tarjeta de Información y Acciones */}
          <Card variant="elevated" padding="lg">
            {/* Icono de advertencia o reloj */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>⚠️</Text>
              </View>
            </View>

            {/* Título y Explicación Comprensible */}
            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.description}>{displayDescription}</Text>

            {/* Cuadro de Orientación: ¿Cuenta ya confirmada? */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>💡 ¿Ya habías confirmado tu cuenta?</Text>
              <Text style={styles.infoBoxText}>
                Si ya hiciste clic en el enlace anteriormente o tu navegador lo validó, tu cuenta
                ya se encuentra activa. Puedes entrar directamente con tus credenciales.
              </Text>
            </View>

            {/* Botón Primario: Iniciar Sesión */}
            <Button
              title="Iniciar Sesión"
              onPress={onNavigateToLogin}
              size="lg"
              style={{ marginBottom: spacing.lg }}
            />

            {/* Divisor */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O SOLICITA UN NUEVO ENLACE</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sección de Reenvío de Confirmación */}
            <Text style={styles.resendInstruction}>
              Si el enlace venció (su validez es de 24 horas) y aún no confirmas tu cuenta, ingresa
              tu correo para recibir uno nuevo:
            </Text>

            <Input
              label="CORREO INSTITUCIONAL"
              placeholder="tu.usuario@alu.uct.cl"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setResendStatus(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Feedback de reenvío */}
            {resendStatus && (
              <View
                style={
                  resendStatus.type === 'success' ? styles.statusSuccessBox : styles.statusErrorBox
                }
              >
                <Text
                  style={
                    resendStatus.type === 'success'
                      ? styles.statusSuccessText
                      : styles.statusErrorText
                  }
                >
                  {resendStatus.message}
                </Text>
              </View>
            )}

            <Button
              title={resending ? 'Enviando enlace...' : 'Reenviar Enlace de Confirmación'}
              onPress={handleResend}
              variant="secondary"
              size="md"
              loading={resending}
              disabled={resending}
              style={{ marginBottom: spacing.md }}
            />

            {/* Aviso Entorno Local */}
            {__DEV__ && (
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>Entorno local de desarrollo</Text>
                <Text style={styles.devText}>
                  Los correos en desarrollo se reciben en Mailpit:{'\n'}
                  http://127.0.0.1:54324
                </Text>
              </View>
            )}

            {/* Enlace alternativo: Ir al registro */}
            <TouchableOpacity style={styles.footerLink} onPress={onNavigateToRegister}>
              <Text style={styles.footerLinkText}>
                ¿No tienes cuenta aún?{' '}
                <Text style={styles.footerLinkBold}>Crear una cuenta nueva</Text>
              </Text>
            </TouchableOpacity>
          </Card>
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
  flex: {
    flex: 1,
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
    backgroundColor: colors.naranjaBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECD5AA',
  },
  badgeText: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.naranja,
    letterSpacing: 0.5,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.naranjaBg,
    borderWidth: 1.5,
    borderColor: '#ECD5AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.cafeOscuro,
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.cuerpo,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  infoBox: {
    backgroundColor: colors.fondo,
    borderColor: colors.bordeOscuro,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoBoxTitle: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: '700',
    color: colors.cafeOscuro,
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borde,
  },
  dividerText: {
    fontSize: typography.etiqueta,
    fontWeight: '700',
    color: colors.textoDeshabilitado,
    letterSpacing: 0.8,
  },
  resendInstruction: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  statusSuccessBox: {
    backgroundColor: colors.verdeBg,
    borderColor: '#C3E6CB',
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  statusSuccessText: {
    color: '#155724',
    fontSize: typography.cuerpoPequeno,
    textAlign: 'center',
  },
  statusErrorBox: {
    backgroundColor: colors.rojoBg,
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  statusErrorText: {
    color: '#A94442',
    fontSize: typography.cuerpoPequeno,
    textAlign: 'center',
  },
  devBox: {
    backgroundColor: colors.doradoBg,
    borderColor: '#ECD5AA',
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
  footerLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  footerLinkText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  footerLinkBold: {
    fontWeight: '700',
    color: colors.cafeOscuro,
  },
});

export default ConfirmationErrorScreen;
