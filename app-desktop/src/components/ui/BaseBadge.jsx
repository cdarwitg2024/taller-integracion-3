// ─── Componente base: Badge / Estado ────────────────────────────────────────
// Normaliza chips de estado en todo el panel administrativo.

import { Chip, styled } from '@mui/material';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', bg: COLORS.errorBg, color: COLORS.error },
  preparando: { label: 'En Preparación', bg: COLORS.warningBg, color: COLORS.warning },
  en_preparacion: { label: 'En Preparación', bg: COLORS.warningBg, color: COLORS.warning },
  listo: { label: 'Listo para Retiro', bg: COLORS.infoBg, color: COLORS.info },
  entregado: { label: 'Entregado', bg: COLORS.successBg, color: COLORS.success },
  cancelado: { label: 'Cancelado', bg: '#F5F5F5', color: '#616161' },
};

export const BaseBadge = styled(Chip)(({ estado }) => {
  const config = ESTADO_CONFIG[estado] || {
    label: estado,
    bg: '#F5F5F5',
    color: '#616161',
  };

  return {
    minHeight: 32,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontSize: TYPOGRAPHY.caption,
    borderRadius: BORDER.radiusSm,
    backgroundColor: config.bg,
    color: config.color,
    '& .MuiChip-label': {
      px: SPACING.md,
      py: SPACING.xs,
    },
  };
});

const BORDER = {
  radiusSm: 6,
};

export const getEstadoConfig = (estado) =>
  ESTADO_CONFIG[estado] || { label: estado, bg: '#F5F5F5', color: '#616161' };

export default BaseBadge;
