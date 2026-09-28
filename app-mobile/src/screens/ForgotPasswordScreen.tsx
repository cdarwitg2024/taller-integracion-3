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

/**
 * Recuperación de contraseña — FR-04
 *
 * El mecanismo es `supabase.auth.resetPasswordForEmail`, que es el que pide
 * el requerimiento. La app NO guarda, hashea ni compara contraseñas: eso es
 * trabajo de Supabase Auth.
 *
 * La contraseña nueva se define más adelante, en la pantalla de
 * "definir contraseña", que se abre sola cuando el usuario vuelve desde el
 * correo y Supabase emite el evento PASSWORD_RECOVERY.
 */
const ForgotPasswordScreen = ({ onBack, onSent }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Paso 2: el link que llego al navegador
  const [enlace, setEnlace] = useState('');

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
    // dominio real de la app.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${getRedirectBase()}/auth/callback`,
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
        setErrorMessage('No se pudo enviar el correo. Intenta de nuevo.');
      }
      return;
    }

    // Éxito. Supabase responde igual (200) tanto si el correo existe como si
    // no, para no revelar qué cuentas están registradas. Por eso el mensaje
    // es genérico a propósito.
    setSent(true);
    onSent?.(email.trim().toLowerCase());
  };

  /**
   * Canjea el enlace de recuperación por una sesión.
   *
   * El enlace del correo es una URL de Supabase que redirige con el
   * `access_token` en el fragmento. `getSessionFromUrl` es el método de
   * supabase-js para ese caso: sigue la redirección, lee el fragmento y deja
   * la sesión lista. Después Supabase dispara PASSWORD_RECOVERY y App.tsx
   * abre la pantalla de contraseña nueva.
   */
  const handleVerifyLink = async () => {
    setErrorMessage(null);

    const limpio = enlace.trim();
    if (!limpio) {
      setErrorMessage('Pega el enlace que abriste en el navegador.');
      return;
    }

    setVerifying(true);

    const { error } = await supabase.auth.getSessionFromUrl(limpio, {
      skipBrowserRedirect: true,
    });

    setVerifying(false);

    if (error) {
      if (/expired|invalid|Token/i.test(error.message)) {
        setErrorMessage('Ese enlace ya no sirve. Pedí uno nuevo.');
      } else {
        setErrorMessage('No pudimos leer el enlace. Copiá la dirección completa.');
      }
      return;
    }

    // Éxito: App.tsx reacciona al evento y muestra la pantalla de contraseña
  };

  // ------------------------------------------------------------ Confirmación
  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✉️</Text>
          </View>

          <Text style={styles.title}>Revisa tu correo</Text>

          <Text style={styles.subtitle}>
            Si {email.trim()} tiene una cuenta en CoffeeFast, te enviamos un enlace para
            definir una contraseña nueva.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Algunas cosas para revisar</Text>
            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>Revisa la carpeta de spam o correo no deseado.</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                El enlace caduca en unas horas, no loUses después de eso.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                Si no llega en unos minutos, revisa que hayas escrito bien tu correo.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={onBack} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setSent(false);
              setEnlace('');
              setErrorMessage(null);
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryButtonText}>Usar otro correo</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>2. Pega el enlace aquí</Text>
            <Text style={styles.infoText}>
              Cuando abras el enlace del correo, copiá la dirección completa de la barra
            del navegador y pegala más abajo para crear tu contraseña nueva.
          </Text>
          </View>
        </ScrollView>
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
            Ingresa tu correo institucional y te enviaremos un enlace para crear una
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
              <Text style={styles.primaryButtonText}>Enviar enlace de recuperación</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🔒 Tu contraseña está segura</Text>
            <Text style={styles.infoText}>
              No guardamos tu contraseña en el teléfono. El enlace abre una sesión
              temporal y la nueva contraseña se guarda directamente en Supabase, que
              es quien la cifra.
            </Text>
          </View>

          {/* Paso 2: pegar el enlace que llegó al navegador */}
          {sent && (
            <View style={styles.step2}>
              <View style={styles.divider} />
              <Text style={styles.step2Title}>¿Ya abriste el enlace?</Text>
              <Text style={styles.step2Text}>
                Abrí el enlace del correo en el navegador y copiá la dirección completa
                de la barra. Pegala acá para que la app tome la sesión y puedas
                escribir tu contraseña nueva.
              </Text>

              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="http://127.0.0.1:8081/#access_token=..."
                placeholderTextColor="#BBB3A8"
                value={enlace}
                onChangeText={(t) => {
                  setEnlace(t);
                  setErrorMessage(null);
                }}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                editable={!verifying}
                accessibilityLabel="Enlace de recuperación"
              />

              <TouchableOpacity
                style={[styles.primaryButton, (!enlace.trim() || verifying) && styles.buttonDisabled]}
                onPress={handleVerifyLink}
                disabled={!enlace.trim() || verifying}
                activeOpacity={0.9}
              >
                {verifying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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

  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bullet: { color: '#8A7568', fontSize: 12, marginRight: 7 },
  bulletText: { flex: 1, fontSize: 11, color: '#6B5B52', lineHeight: 16 },

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

  step2: { marginTop: 18 },
  divider: { height: 1, backgroundColor: '#DDD3CA', marginBottom: 18 },
  step2Title: { fontSize: 15, fontWeight: '800', color: '#2E2521', marginBottom: 6 },
  step2Text: { fontSize: 12, color: '#7A6A61', lineHeight: 18, marginBottom: 14 },
  inputMultiline: {
    minHeight: 78,
    textAlignVertical: 'top',
    fontSize: 11,
    marginBottom: 14,
  },
});

export default ForgotPasswordScreen;
