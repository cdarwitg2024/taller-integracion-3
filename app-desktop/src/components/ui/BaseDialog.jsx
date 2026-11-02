// ─── Componente base: Modal / Diálogo ───────────────────────────────────────
// Normaliza diálogos y modales del panel administrativo.

import {
  Dialog as MuiDialog,
  DialogTitle as MuiDialogTitle,
  DialogContent as MuiDialogContent,
  DialogActions as MuiDialogActions,
  styled,
} from '@mui/material';
import { COLORS, SPACING, BORDER, SHADOWS, TYPOGRAPHY } from '../../design/tokens';

export const BaseDialog = styled(MuiDialog)({
  '& .MuiDialog-paper': {
    borderRadius: BORDER.radiusXl,
    border: `1px solid ${COLORS.border}`,
    boxShadow: SHADOWS.lg,
    backgroundColor: COLORS.surface,
  },
});

export const BaseDialogTitle = styled(MuiDialogTitle)({
  padding: `${SPACING.xl}px ${SPACING.xxl}px ${SPACING.md}px`,
  borderBottom: `1px solid ${COLORS.border}`,
  '& .MuiDialogTitle-root': {
    fontSize: TYPOGRAPHY.h5,
    fontWeight: TYPOGRAPHY.fontWeightExtraBold,
    color: COLORS.textPrimary,
    letterSpacing: '-0.5px',
  },
});

export const BaseDialogContent = styled(MuiDialogContent)({
  padding: `${SPACING.md}px ${SPACING.xxl}px ${SPACING.md}px`,
});

export const BaseDialogActions = styled(MuiDialogActions)({
  padding: `${SPACING.md}px ${SPACING.xxl}px ${SPACING.xl}px`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: SPACING.md,
  borderTop: `1px solid ${COLORS.border}`,
});

export default {
  BaseDialog,
  BaseDialogTitle,
  BaseDialogContent,
  BaseDialogActions,
};
