import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/**
 * Tarjeta base de CoffeeFast
 * 
 * Props:
 * - children: Contenido de la tarjeta
 * - variant: 'default' | 'elevated' | 'outlined'
 * - padding: 'none' | 'sm' | 'md' | 'lg'
 * - style: Estilos adicionales
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
    borderRadius: 16,
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
