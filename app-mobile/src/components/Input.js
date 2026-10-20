import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Campo de texto base de CoffeeFast.
 *
 * S2-T1: componente reutilizable normalizado (label + input + error).
 *
 * Props:
 * - label: Etiqueta del campo
 * - placeholder: Texto de ayuda
 * - value: Valor del campo
 * - onChangeText: Función al cambiar texto
 * - error: Mensaje de error (pinta el borde y muestra el texto)
 * - style: Estilos del contenedor externo
 * - inputStyle: Estilos del TextInput
 * - ...rest: Cualquier otra prop de TextInput (keyboardType, secureTextEntry,
 *   autoCapitalize, autoCorrect, maxLength, onSubmitEditing, returnKeyType,
 *   editable, multiline, onFocus, onBlur, textContentType, etc.)
 *
 * @type {React.FC<{
 *   label?: React.ReactNode,
 *   placeholder?: string,
 *   value?: string,
 *   onChangeText?: (text: string) => void,
 *   error?: React.ReactNode,
 *   style?: any,
 *   inputStyle?: any,
 *   autoCapitalize?: 'none'|'sentences'|'words'|'characters',
 *   autoCorrect?: boolean,
 *   children?: React.ReactNode,
 *   readonly [prop: string]: any,
 * }>}
 */
const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error = undefined,
  style = {},
  inputStyle = {},
  autoCapitalize = 'none',
  autoCorrect = true,
  ...rest
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={colors.textoDeshabilitado}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        {...rest}
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
    borderRadius: radius.md,
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
