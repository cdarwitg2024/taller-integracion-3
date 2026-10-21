import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';

/**
 * Tarjeta base de CoffeeFast.
 *
 * S2-T1: componente reutilizable normalizado. Úsala como contenedor blanco
 * estándar (formularios, bloques de info, listas) para que el fondo, el borde,
 * el radio y la sombra sean iguales en toda la app.
 *
 * Props:
 * - children: Contenido de la tarjeta
 * - variant: 'default' | 'elevated' | 'outlined'
 * - padding: 'none' | 'sm' | 'md' | 'lg'
 * - style: Estilos adicionales
 *
 * @type {React.FC<{
 *   children?: React.ReactNode,
 *   variant?: 'default'|'elevated'|'outlined',
 *   padding?: 'none'|'sm'|'md'|'lg',
 *   style?: any,
 * }>}
 */
const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  style = {},
}) => {
  const cardStyles = [
    styles.base,
    styles[variant],
    styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`],
    style,
  ];

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
  },
  default: {
    borderWidth: 1,
    borderColor: colors.borde,
  },
  elevated: {
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.borde,
  },
  paddingNone: {
    padding: 0,
  },
  paddingSm: {
    padding: spacing.sm,
  },
  paddingMd: {
    padding: spacing.md,
  },
  paddingLg: {
    padding: spacing.lg,
  },
});

export default Card;
