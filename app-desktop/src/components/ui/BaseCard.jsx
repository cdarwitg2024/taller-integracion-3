// ─── Componente base: Tarjeta ───────────────────────────────────────────────
// Normaliza tarjetas del panel administrativo (KPI, pedido, producto, etc.).

import { Card as MuiCard, styled } from '@mui/material';
import { COLORS, SPACING, BORDER, SHADOWS } from '../../design/tokens';

const COMPONENT_PADDING = 'md';

const PADDING_VALUES = {
  none: 0,
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
  xl: SPACING.xl,
};

export const BaseCard = styled(MuiCard)(({ variant = 'default', padding = COMPONENT_PADDING }) => ({
  borderRadius: BORDER.radiusLg,
  border: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.surface,
  boxShadow: SHADOWS.sm,
  transition: 'all 0.2s ease',
  overflow: 'hidden',

  '&:hover': {
    boxShadow: SHADOWS.md,
  },

  ...(variant === 'elevated' && {
    boxShadow: SHADOWS.lg,
    border: 'none',
  }),

  ...(variant === 'outlined' && {
    border: `2px solid ${COLORS.border}`,
    backgroundColor: COLORS.surfaceAlt,
  }),

  ...(padding === 'none' && {
    padding: 0,
  }),
  ...(padding && PADDING_VALUES[padding] !== undefined && {
    padding: PADDING_VALUES[padding],
  }),
}));

export default BaseCard;
