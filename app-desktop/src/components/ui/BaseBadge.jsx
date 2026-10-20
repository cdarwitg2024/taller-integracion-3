// ─── Componente base: Badge / Estado ────────────────────────────────────────
// Normaliza chips de estado en todo el panel administrativo y en el KDS.
//
// El label, el fondo y el color del texto salen de ESTADO_CONFIG, que es la
// fuente única de verdad: quien lo usa solo pasa `estado` (y opcionalmente
// `label` o `sx` si necesita sobreescribir algo puntual).

import { Chip, styled } from '@mui/material';
import { COLORS, SPACING, TYPOGRAPHY, BORDER } from '../../design/tokens';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', bg: COLORS.errorBg, color: COLORS.error },
  preparando: { label: 'En Preparación', bg: COLORS.warningBg, color: COLORS.warning },
  en_preparacion: { label: 'En Preparación', bg: COLORS.warningBg, color: COLORS.warning },
  listo: { label: 'Listo para Retiro', bg: COLORS.infoBg, color: COLORS.info },
  entregado: { label: 'Entregado', bg: COLORS.successBg, color: COLORS.success },
  cancelado: { label: 'Cancelado', bg: '#F5F5F5', color: '#616161' },
};

/** Config de un estado; devuelve un valor neutro para estados desconocidos. */
export const getEstadoConfig = (estado) =>
  ESTADO_CONFIG[estado] || { label: String(estado ?? ''), bg: '#F5F5F5', color: '#616161' };

// `estado` no es un atributo válido del DOM, por eso no se reenvía al Chip.
const StyledBadge = styled(Chip, { shouldForwardProp: (prop) => prop !== 'estado' })(({ estado }) => {
  const config = getEstadoConfig(estado);

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

function BaseBadge({ estado, label, ...rest }) {
  const config = getEstadoConfig(estado);
  return <StyledBadge estado={estado} label={label ?? config.label} {...rest} />;
}

export default BaseBadge;
