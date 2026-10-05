import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Definir contraseña nueva — FR-04 (segunda parte)
 *
 * Se abre sola cuando el usuario vuelve desde el correo: Supabase emite el
 * evento `PASSWORD_RECOVERY` y la app lo intercepta (ver App.tsx).
 *
 * `supabase.auth.updateUser({ password })` guarda la contraseña ya cifrada en
 * Supabase. La app nunca ve ni guarda el valor en disco.
 */
type Props = {
  /** Vuelve al inicio de sesión cuando la contraseña ya quedó guardada. */
  onDone: () => void;
};

const ResetPasswordScreen = ({ onDone }: Props) => {
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
          <View style={styles.successCircle}>
            <Text style={styles.successMark}>✓</Text>
          </View>
          <Text style={styles.title}>Contraseña actualizada</Text>
          <Text style={styles.subtitle}>
            Ya podés entrar con tu contraseña nueva.
          </Text>
          <Button title="Ir al inicio de sesión" onPress={onDone} size="lg" />
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
          <Text style={styles.title}>Crea tu contraseña nueva</Text>

          <Text style={styles.subtitle}>
            Elegí una contraseña que no hayas usado antes. Mínimo 8 caracteres.
          </Text>

          {errorMessage && (
            <Card variant="default" padding="none" style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Card>
          )}

          <View style={styles.labelRow}>
            <Text style={styles.label}>Nueva contraseña</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textoDeshabilitado}
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
            <TouchableOpacity
              onPress={() => setShow(!show)}
              style={styles.eyeIcon}
              accessibilityRole="button"
              accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Text style={styles.eyeIconText}>{show ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Repetir contraseña</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textoDeshabilitado}
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
          <Card variant="default" padding="none" style={styles.rulesBox}>
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
          </Card>

          <Button
            title="Guardar contraseña"
            onPress={handleSave}
            loading={loading}
            disabled={!puedeEnviar}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingVertical: 28, justifyContent: 'center' },

  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.verdeBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  successMark: {
    fontSize: 30,
    fontWeight: typography.pesoBold,
    color: colors.verde,
    lineHeight: 34,
  },

  title: {
    fontSize: 22,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },

  labelRow: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 11, fontWeight: typography.pesoBold, color: colors.textoSecundario, textTransform: 'uppercase' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borde,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: typography.cuerpo, color: colors.cafeOscuro },
  eyeIcon: { paddingLeft: spacing.sm },
  eyeIconText: { fontSize: 11, fontWeight: typography.pesoBold, color: '#E07A5F' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.rojoBg,
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: typography.cuerpoPequeno, color: colors.rojo, lineHeight: 17, fontWeight: typography.pesoMedio },

  rulesBox: {
    backgroundColor: colors.crema,
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  ruleMark: { fontSize: 13, color: colors.textoDeshabilitado, marginRight: spacing.sm, width: 14 },
  ruleOk: { color: colors.verde },
  ruleText: { fontSize: typography.cuerpoPequeno, color: colors.textoSecundario },
  ruleTextOk: { color: colors.verde, fontWeight: typography.pesoMedio },
});

export default ResetPasswordScreen;
