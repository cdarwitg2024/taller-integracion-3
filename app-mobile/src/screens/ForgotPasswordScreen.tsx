import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

/**
 * Base del redirect de recuperación.
 *
 * Tiene que ser http(s) y estar en la lista blanca de Redirect URLs del
 * proyecto Supabase. GoTrue rechaza los esquemas propios (`coffeefast://`)
 * aunque esten permitidos, por eso no usamos deep link.
 */
const getRedirectBase = () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(url).origin;
  } catch {
    return 'http://127.0.0.1:8081';
  }
};

/** Largo del código que manda Supabase (ver auth.email.otp_length). */
const LARGO_CODIGO = 6;

type Props = {
  /** Vuelve a la pantalla de inicio de sesión. */
  onBack: () => void;
  /** Se llama cuando el código fue validado y ya hay sesión de recuperación. */
  onCodeVerified?: () => void;
};

/**
 * Recuperación de contraseña — FR-04
 *
 * El flujo son tres pasos, todos supported por Supabase Auth:
 *
 *   1. `resetPasswordForEmail(correo)`  → Supabase genera un código de 6
 *      dígitos y lo manda al correo. La app no genera ni guarda el código.
 *   2. `verifyOtp({ email, token, type: 'recovery' })` → canjea el código por
 *      una sesión temporal.
 *   3. `updateUser({ password })` (en ResetPasswordScreen) → Supabase cifra y
 *      guarda la contraseña nueva.
 *
 * La app NO guarda, hashea ni compara contraseñas: eso es trabajo de Supabase
 * Auth. Tampoco guarda el código: solo lo manda a la API y lo descarta.
 */
const ForgotPasswordScreen = ({ onBack, onCodeVerified }: Props) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Paso 2: el código de 6 dígitos que llegó al correo
  const [codigo, setCodigo] = useState('');

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codigoCompleto = codigo.length === LARGO_CODIGO;

  /** Normaliza a mayúsculas, quita espacios y deja solo dígitos. */
  const limpiarCodigo = (texto: string) => texto.replace(/\D/g, '').slice(0, LARGO_CODIGO);

  const handleSend = async () => {
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Ingresa tu correo institucional.');
      return;
    }

    if (!correoValido) {
      setErrorMessage('El correo no tiene un formato válido.');
      return;
    }

    setLoading(true);

    // redirectTo debe ser una URL http(s) registrada en la lista blanca del
    // proyecto. Los esquemas propios (coffeefast://) los rechaza GoTrue, asi
    // que en desarrollo apunta al servidor de Metro y en produccion al
    // dominio real de la app. Solo se usa si alguien abre el enlace del
    // correo; el flujo normal es solo el código.
    const correo = email.trim().toLowerCase();
    const destino = `${getRedirectBase()}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: destino,
    });

    setLoading(false);

    if (error) {
      // Supabase distingue estos casos; los mapeamos a mensajes en español.
      const msg = error.message || '';
      if (/rate|too many|demasiad/i.test(msg)) {
        setErrorMessage('Demasiados intentos. Espera un momento y vuelve a intentar.');
      } else if (/failed to fetch|Network/i.test(msg)) {
        setErrorMessage('No pudimos conectarnos. Revisa tu conexión.');
      } else {
        setErrorMessage('No se pudo enviar el código. Intenta de nuevo.');
      }
      return;
    }

    // Éxito. Supabase responde igual (200) tanto si el correo existe como si
    // no, para no revelar qué cuentas están registradas. Por eso el mensaje
    // es genérico a propósito.
    setCodigo('');
    setSent(true);
  };

  /**
   * Canjea el código de 6 dígitos por una sesión de recuperación.
   *
   * `verifyOtp` con `type: 'recovery'` es el método de supabase-js para este
   * caso: el código se manda a la API de Auth y, si es válido, Supabase
   * devuelve una sesión. No hay que abrir el navegador ni seguir ninguna
   * redirección, que es lo que hacía fallar el flujo con enlace.
   */
  const handleVerifyCode = async () => {
    setErrorMessage(null);

    if (!codigoCompleto) {
      setErrorMessage(`El código tiene ${LARGO_CODIGO} dígitos.`);
      return;
    }

    setVerifying(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigo,
      type: 'recovery',
    });

    setVerifying(false);

    if (error) {
      const msg = error.message || '';
      if (/expired|invalid|venció|vencio/i.test(msg)) {
        setErrorMessage('Ese código ya venció. Pedí uno nuevo.');
      } else if (/rate|too many|demasiad/i.test(msg)) {
        setErrorMessage('Demasiados intentos. Espera un momento y vuelve a intentar.');
      } else {
        setErrorMessage('El código no es correcto. Revisa los números e intenta de nuevo.');
      }
      return;
    }

    // Éxito: ya hay una sesión temporal válida para cambiar la contraseña.
    // Además del evento PASSWORD_RECOVERY que escucha App.tsx, avisamos
    // explícitamente para no depender del orden de los eventos.
    onCodeVerified?.();
  };

  /** Vuelve al formulario para pedir otro correo. */
  const handleUsarOtroCorreo = () => {
    setSent(false);
    setCodigo('');
    setErrorMessage(null);
  };

  /** Vuelve al formulario conservando el correo, para reenviar el código. */
  const handleReenviar = () => {
    setCodigo('');
    setErrorMessage(null);
    setSent(false);
  };

  // ------------------------------------------------------------ Confirmación
  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>📬</Text>
            </View>

            <Text style={styles.title}>Ingresa tu código</Text>

            <Text style={styles.subtitle}>
              Mandamos un código de {LARGO_CODIGO} dígitos a {email.trim()}. Ingresalo abajo
              para crear tu contraseña nueva.
            </Text>

            {/* Ayuda para desarrollo local: el correo no sale a Gmail, queda en Mailpit */}
            {__DEV__ && (
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>🧪 Entorno local</Text>
                <Text style={styles.devText}>
                  El correo no llega a Gmail. Queda en Mailpit:{'\n'}
                  http://127.0.0.1:54324{'\n\n'}
                  Solo se envían códigos a cuentas que existen. Probá con{'\n'}
                  estudiante@alu.uct.cl
                </Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TextInput
              style={[styles.input, styles.codigoInput]}
              placeholder={'0'.repeat(LARGO_CODIGO)}
              placeholderTextColor="#D6CCC2"
              value={codigo}
              onChangeText={(t) => {
                setCodigo(limpiarCodigo(t));
                setErrorMessage(null);
              }}
              keyboardType="number-pad"
              maxLength={LARGO_CODIGO}
              editable={!verifying}
              accessibilityLabel={`Código de ${LARGO_CODIGO} dígitos`}
            />

            <TouchableOpacity
              style={[styles.primaryButton, (!codigoCompleto || verifying) && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={!codigoCompleto || verifying}
              activeOpacity={0.9}
            >
              {verifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continuar con la recuperación</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleReenviar} activeOpacity={0.9}>
              <Text style={styles.secondaryButtonText}>No lo recibí · Enviar de nuevo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleUsarOtroCorreo} activeOpacity={0.9}>
              <Text style={styles.secondaryButtonText}>Usar otro correo</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>🔒 Tu contraseña está segura</Text>
              <Text style={styles.infoText}>
                Nunca te enviamos tu contraseña. Solo un código temporal de{' '}
                {LARGO_CODIGO} dígitos que vence en una hora y sirve una sola vez. La app no
                lo guarda: lo manda a Supabase y lo borra.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------- Formulario
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🔑</Text>
          </View>

          <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>

          <Text style={styles.subtitle}>
            Ingresa tu correo institucional y te enviaremos un código para crear una
            contraseña nueva.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.labelRow}>
            <Text style={styles.label}>Correo institucional</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="tunombre@alu.uct.cl"
              placeholderTextColor="#BBB3A8"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrorMessage(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Correo institucional"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (!correoValido || loading) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!correoValido || loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Enviar código de recuperación</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Cómo funciona</Text>
            <Text style={styles.infoText}>
              Te llega un código de {LARGO_CODIGO} dígitos al correo. Lo ingresas en la app
              y ahí definís tu contraseña nueva. No hace falta abrir ningún enlace.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4F1' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },

  backButton: { alignSelf: 'flex-start', marginBottom: 18, paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: '600', color: '#6B5B52' },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFE6DE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  icon: { fontSize: 30 },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E2521',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    color: '#7A6A61',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },

  labelRow: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', color: '#7A6A61', textTransform: 'uppercase' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DAD2',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: { fontSize: 15, marginRight: 9 },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, color: '#2E2521' },

  codigoInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DAD2',
    paddingVertical: 16,
    paddingHorizontal: 14,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 14,
    textAlign: 'center',
    color: '#2E2521',
    marginBottom: 16,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  errorIcon: { fontSize: 13, marginRight: 8 },
  errorText: { flex: 1, fontSize: 12, color: '#A33A2A', lineHeight: 17, fontWeight: '600' },

  infoBox: {
    backgroundColor: '#EFEAE5',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  infoTitle: { fontSize: 12, fontWeight: '800', color: '#4A3C34', marginBottom: 7 },
  infoText: { fontSize: 11, color: '#6B5B52', lineHeight: 17 },

  primaryButton: {
    backgroundColor: '#4A3C34',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#B9AEA6' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  secondaryButton: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#6B5B52', fontSize: 13, fontWeight: '600' },

  devBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0DFA8',
  },
  devTitle: { fontSize: 12, fontWeight: '800', color: '#8A6D1F', marginBottom: 5 },
  devText: { fontSize: 11, color: '#7A6A45', lineHeight: 17 },
});

export default ForgotPasswordScreen;
