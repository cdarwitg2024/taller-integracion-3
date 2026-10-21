import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Botón base de CoffeeFast.
 *
 * S2-T1: componente reutilizable normalizado. Todas las pantallas deben usar
 * este botón en vez de armar `TouchableOpacity` a mano, para que altura,
 * radios, tipografía y colores sean consistentes.
 *
 * Props:
 * - title: Texto del botón (string o nodo)
 * - onPress: Función al presionar
 * - variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
 * - size: 'sm' | 'md' | 'lg'
 * - disabled: Boolean
 * - loading: Boolean (muestra un spinner y bloquea el press)
 * - fullWidth: Boolean (ocupa el 100% del ancho)
 * - icon: Nodo opcional a la izquierda del texto
 * - style: Estilos del contenedor
 * - textStyle: Estilos del texto
 *
 * @type {React.FC<{
 *   title?: React.ReactNode,
 *   onPress?: () => void,
 *   variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger',
 *   size?: 'sm'|'md'|'lg',
 *   disabled?: boolean,
 *   loading?: boolean,
 *   fullWidth?: boolean,
 *   icon?: React.ReactNode,
 *   style?: any,
 *   textStyle?: any,
 *   accessibilityLabel?: string,
 *   children?: React.ReactNode,
 * }>}
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  style = {},
  textStyle = {},
  accessibilityLabel,
  ...rest
}) => {
  const bloqueado = disabled || loading;

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    bloqueado && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.textBase,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    textStyle,
  ];

  // El spinner debe contrastar con el fondo del botón: blanco sobre las
  // variantes de fondo oscuro, color primario sobre las claras.
  const colorSpinner =
    variant === 'primary' || variant === 'danger'
      ? colors.textoBlanco
      : colors.textoPrimario;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={bloqueado}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
      accessibilityState={{ disabled: bloqueado }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colorSpinner} />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          {typeof title === 'string' ? <Text style={textStyles}>{title}</Text> : title}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
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
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.cafeOscuro,
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
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: colors.cafeClaro,
  },
  icon: {
    marginRight: spacing.sm,
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
  outlineText: {
    color: colors.cafeOscuro,
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
