// ─── Componente base: Botón ─────────────────────────────────────────────────
// Normaliza tamaños, variantes y colores del panel administrativo.

import { Button as MuiButton, styled } from '@mui/material';
import { COLORS, SPACING, TYPOGRAPHY, COMPONENT } from '../../design/tokens';

const BORDER = {
  radiusMd: 10,
};

const SHADOWS = {
  md: '0 6px 16px rgba(74, 55, 40, 0.08)',
};

export const BaseButton = styled(MuiButton)(({ theme }) => ({
  minHeight: COMPONENT.minHeightButton,
  minWidth: COMPONENT.minHeightButton,
  borderRadius: BORDER.radiusMd,
  fontWeight: TYPOGRAPHY.fontWeightBold,
  fontSize: TYPOGRAPHY.body1,
  textTransform: 'none',
  letterSpacing: 0.5,
  px: SPACING.xl,
  py: SPACING.md,
  transition: 'all 0.2s ease',

  // Variante primaria
  '&.variant-primary': {
    backgroundColor: COLORS.primary,
    color: COLORS.textOnPrimary,
    '&:hover': {
      backgroundColor: COLORS.primaryHover,
      boxShadow: SHADOWS.md,
    },
  },

  // Variante secundaria
  '&.variant-secondary': {
    backgroundColor: COLORS.secondaryLight,
    color: COLORS.primary,
    border: `1px solid ${COLORS.border}`,
    '&:hover': {
      backgroundColor: COLORS.secondary,
      color: COLORS.textOnPrimary,
    },
  },

  // Variante outlined
  '&.variant-outlined': {
    backgroundColor: 'transparent',
    color: COLORS.primary,
    border: `1px solid ${COLORS.border}`,
    '&:hover': {
      backgroundColor: COLORS.primaryLight,
      borderColor: COLORS.primary,
    },
  },

  // Variante danger / error
  '&.variant-danger': {
    backgroundColor: COLORS.error,
    color: COLORS.textOnPrimary,
    '&:hover': {
      backgroundColor: '#B00020',
    },
  },

  // Variante success
  '&.variant-success': {
    backgroundColor: COLORS.success,
    color: COLORS.textOnPrimary,
    '&:hover': {
      backgroundColor: '#1B5E20',
    },
  },

  // Tamaño grande
  '&.size-lg': {
    minHeight: 56,
    fontSize: TYPOGRAPHY.h6,
    px: SPACING.xxl,
  },

  // Tamaño pequeño
  '&.size-sm': {
    minHeight: 40,
    fontSize: TYPOGRAPHY.caption,
    px: SPACING.lg,
  },

  // Deshabilitado
  '&.variant-disabled, &:disabled': {
    backgroundColor: '#D8CEC4',
    color: '#9E8D82',
    cursor: 'not-allowed',
    '&:hover': {
      backgroundColor: '#D8CEC4',
      boxShadow: 'none',
    },
  },
}));

export default BaseButton;
