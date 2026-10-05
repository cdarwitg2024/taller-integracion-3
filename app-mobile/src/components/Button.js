import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Botón base de CoffeeFast
 * 
 * Props:
 * - title: Texto del botón
 * - onPress: Función al presionar
 * - variant: 'primary' | 'secondary' | 'ghost' | 'danger'
 * - size: 'sm' | 'md' | 'lg'
 * - disabled: Boolean
 * - loading: Boolean
 * - style: Estilos adicionales
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style = {},
}) => {
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.textBase,
    styles[`${variant}Text`],
    styles[`${size}Text`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textoBlanco : colors.textoPrimario}
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: colors.cafeOscuro,
  },
  secondary: {
    backgroundColor: colors.crema,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  danger: {
    backgroundColor: colors.rojo,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  disabled: {
    backgroundColor: colors.cafeClaro,
  },
  textBase: {
    fontWeight: typography.pesoBold,
  },
  primaryText: {
    color: colors.textoBlanco,
  },
  secondaryText: {
    color: colors.textoPrimario,
  },
  ghostText: {
    color: colors.textoPrimario,
  },
  dangerText: {
    color: colors.textoBlanco,
  },
  smText: {
    fontSize: typography.cuerpoPequeno,
  },
  mdText: {
    fontSize: typography.cuerpo,
  },
  lgText: {
    fontSize: typography.subtitulo,
  },
});

export default Button;
