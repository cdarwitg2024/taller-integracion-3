// ─── Componente base: Input ─────────────────────────────────────────────────
// Normaliza campos de texto del panel administrativo.

import { TextField as MuiTextField, styled } from '@mui/material';
import { COLORS, SPACING, BORDER, TYPOGRAPHY } from '../../design/tokens';

export const BaseInput = styled(MuiTextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: BORDER.radiusMd,
    backgroundColor: COLORS.surface,
    '& fieldset': {
      borderColor: COLORS.border,
      borderWidth: 1,
    },
    '&:hover fieldset': {
      borderColor: COLORS.textSecondary,
    },
    '&.Mui-focused fieldset': {
      borderColor: COLORS.primary,
      borderWidth: 2,
    },
  },
  '& .MuiInputLabel-root': {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    '&.Mui-focused': {
      color: COLORS.primary,
    },
  },
  '& .MuiInputBase-input': {
    fontSize: TYPOGRAPHY.body1,
    color: COLORS.textPrimary,
    px: SPACING.md,
  },
});

export default BaseInput;
