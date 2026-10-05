import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Campo de texto base de CoffeeFast
 * 
 * Props:
 * - label: Etiqueta del campo
 * - placeholder: Texto de ayuda
 * - value: Valor del campo
 * - onChangeText: Función al cambiar texto
 * - keyboardType: Tipo de teclado
 * - secureTextEntry: Boolean
 * - maxLength: Longitud máxima
 * - autoCapitalize: 'none' | 'sentences' | 'words' | 'characters'
 * - error: Mensaje de error
 * - style: Estilos adicionales
 */
const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength = undefined,
  autoCapitalize = 'none',
  autoCorrect = true,
  error = undefined,
  style = {},
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.textoDeshabilitado}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.fondo,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoMedio,
    color: colors.textoPrimario,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  inputError: {
    borderColor: colors.rojo,
  },
  errorText: {
    fontSize: typography.etiqueta,
    color: colors.rojo,
    marginTop: spacing.xs,
  },
});

export default Input;
