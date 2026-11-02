// ─── Componente base: Tabla ─────────────────────────────────────────────────
// Normaliza tablas del panel administrativo.

import {
  Table as MuiTable,
  TableBody as MuiTableBody,
  TableCell as MuiTableCell,
  TableContainer as MuiTableContainer,
  TableHead as MuiTableHead,
  TableRow as MuiTableRow,
  Paper,
  styled,
} from '@mui/material';
import { COLORS, SPACING, BORDER, TYPOGRAPHY } from '../../design/tokens';

export const BaseTableContainer = styled(Paper)({
  borderRadius: BORDER.radiusLg,
  border: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.surface,
  overflow: 'hidden',
});

export const BaseTable = styled(MuiTable)({
  minWidth: 650,
});

export const BaseTableHead = styled(MuiTableHead)(({ theme }) => ({
  '& .MuiTableCell-head': {
    backgroundColor: `${COLORS.primaryLight} !important`,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontSize: TYPOGRAPHY.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${COLORS.border}`,
    py: SPACING.md,
  },
}));

export const BaseTableBody = styled(MuiTableBody)({});

export const BaseTableCell = styled(MuiTableCell)(({ variant = 'body' }) => ({
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: TYPOGRAPHY.body2,
  color: COLORS.textSecondary,
  py: SPACING.md,

  ...(variant === 'head' && {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    fontSize: TYPOGRAPHY.caption,
  }),

  ...(variant === 'footer' && {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
    borderTop: `2px solid ${COLORS.border}`,
  }),
}));

export const BaseTableRow = styled(MuiTableRow)({
  '&:hover': {
    backgroundColor: `${COLORS.primaryLight}`,
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
});

export default {
  BaseTableContainer,
  BaseTable,
  BaseTableHead,
  BaseTableBody,
  BaseTableCell,
  BaseTableRow,
};
