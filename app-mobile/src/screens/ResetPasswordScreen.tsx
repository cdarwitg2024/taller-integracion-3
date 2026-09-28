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
 * Definir contraseña nueva — FR-04 (segunda parte)
 *
 * Se abre sola cuando el usuario vuelve desde el correo: Supabase emite el
 * evento `PASSWORD_RECOVERY` y la app lo intercepta (ver App.tsx).
 *
 * `supabase.auth.updateUser({ password })` guarda la contraseña ya cifrada en
 * Supabase. La app nunca ve ni guarda el valor en disco.
 */
const ResetPasswordScreen = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cumpleReglas = password.length >= 8;
  const coinciden = password.length > 0 && password === confirm;
  const puedeEnviar = cumpleReglas && coinciden && !loading;

  const handleSave = async () => {
    setErrorMessage(null);

    if (!cumpleReglas) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!coinciden) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      if (/Auth session missing|Invalid Refresh Token/i.test(error.message)) {
        setErrorMessage(
          'La sesión de recuperación expiró. Pedí un enlace nuevo desde el inicio de sesión.'
        );
      } else {
        setErrorMessage('No se pudo guardar la contraseña. Intenta de nuevo.');
      }
      return;
    }

    setOk(true);
  };

  if (ok) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✅</Text>
          </View>
          <Text style={styles.title}>Contraseña actualizada</Text>
          <Text style={styles.subtitle}>
            Ya podés entrar con tu contraseña nueva.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onDone} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Ir al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.icon}>🔒</Text>
          </View>

          <Text style={styles.title}>Crea tu contraseña nueva</Text>

          <Text style={styles.subtitle}>
            Elegí una contraseña que no hayas usado antes. Mínimo 8 caracteres.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.labelRow}>
            <Text style={styles.label}>Nueva contraseña</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔑</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#BBB3A8"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrorMessage(null);
              }}
              secureTextEntry={!show}
              autoCapitalize="none"
              editable={!loading}
              accessibilityLabel="Nueva contraseña"
            />
            <TouchableOpacity onPress={() => setShow(!show)} style={styles.eyeIcon}>
              <Text>{show ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Repetir contraseña</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔑</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#BBB3A8"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                setErrorMessage(null);
              }}
              secureTextEntry={!show}
              autoCapitalize="none"
              editable={!loading}
              onSubmitEditing={puedeEnviar ? handleSave : undefined}
              accessibilityLabel="Repetir contraseña"
            />
          </View>

          {/* Reglas de validación, se muestran en vivo */}
          <View style={styles.rulesBox}>
            <View style={styles.ruleRow}>
              <Text style={[styles.ruleMark, cumpleReglas && styles.ruleOk]}>
                {cumpleReglas ? '✓' : '○'}
              </Text>
              <Text style={[styles.ruleText, cumpleReglas && styles.ruleTextOk]}>
                Al menos 8 caracteres
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={[styles.ruleMark, coinciden && styles.ruleOk]}>
                {coinciden ? '✓' : '○'}
              </Text>
              <Text style={[styles.ruleText, coinciden && styles.ruleTextOk]}>
                Las dos contraseñas coinciden
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !puedeEnviar && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!puedeEnviar}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Guardar contraseña</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4F1' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },

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
  eyeIcon: { paddingHorizontal: 4 },

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

  rulesBox: {
    backgroundColor: '#EFEAE5',
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ruleMark: { fontSize: 13, color: '#A99C94', marginRight: 8, width: 14 },
  ruleOk: { color: '#4A7A47' },
  ruleText: { fontSize: 12, color: '#8A7A70' },
  ruleTextOk: { color: '#4A7A47', fontWeight: '600' },

  primaryButton: {
    backgroundColor: '#4A3C34',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#B9AEA6' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

export default ResetPasswordScreen;
