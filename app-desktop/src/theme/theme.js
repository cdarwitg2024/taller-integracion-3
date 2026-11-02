import { createTheme } from '@mui/material/styles';
import { COLORS, TYPOGRAPHY, BORDER, SHADOWS } from '../design/tokens';

const theme = createTheme({
  palette: {
    primary: {
      main: COLORS.primary,
    },
    secondary: {
      main: COLORS.secondary,
    },
    background: {
      default: COLORS.background,
      paper: COLORS.surface,
    },
    success: {
      main: COLORS.success,
    },
    warning: {
      main: COLORS.warning,
    },
    error: {
      main: COLORS.error,
    },
    text: {
      primary: COLORS.textPrimary,
      secondary: COLORS.textSecondary,
    },
    divider: COLORS.border,
  },

  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    h1: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h1,
      fontWeight: TYPOGRAPHY.fontWeightExtraBold,
    },
    h2: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h2,
      fontWeight: TYPOGRAPHY.fontWeightExtraBold,
    },
    h3: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h3,
      fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    h4: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h4,
      fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    h5: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h5,
      fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    h6: {
      fontFamily: TYPOGRAPHY.fontFamilySerif,
      fontSize: TYPOGRAPHY.h6,
      fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    body1: {
      fontSize: TYPOGRAPHY.body1,
      fontWeight: TYPOGRAPHY.fontWeightRegular,
      lineHeight: TYPOGRAPHY.lineHeightNormal,
    },
    body2: {
      fontSize: TYPOGRAPHY.body2,
      fontWeight: TYPOGRAPHY.fontWeightRegular,
      lineHeight: TYPOGRAPHY.lineHeightNormal,
    },
    caption: {
      fontSize: TYPOGRAPHY.caption,
      fontWeight: TYPOGRAPHY.fontWeightMedium,
    },
  },

  shape: {
    borderRadius: BORDER.radiusMd,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
          fontSize: '1rem',
          borderRadius: BORDER.radiusMd,
          textTransform: 'none',
          fontWeight: TYPOGRAPHY.fontWeightBold,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
          borderRadius: BORDER.radiusMd,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
          borderRadius: BORDER.radiusMd,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: BORDER.radiusMd,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            minHeight: 48,
            borderRadius: BORDER.radiusMd,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: BORDER.radiusLg,
        },
      },
    },
  },
});

// ── Tokens compartidos del layout de escritorio (KDS / Panel de dueño) ──────
// Fuente única de verdad: `drawerWidth` estaba repetido en app.jsx,
// AppLayout.jsx y sidebar.jsx, y las superficies del KDS estaban como hex
// sueltos en cada componente. Los colores derivan del tema de arriba.
export const drawerWidth = 260;

export const kdsColors = {
  canvas: theme.palette.background.default, // fondo general de las vistas
  surface: theme.palette.background.paper, // tarjetas / superficies claras
  border: theme.palette.divider, // bordes y separadores
  header: theme.palette.primary.main, // barra superior del KDS
  sidebar: '#433225', // café un tono más oscuro que el header (prototipos)
  accent: '#C86237', // botón principal (Escanear QR)
  accentHover: '#B2522B',
  onDark: theme.palette.common.white, // texto sobre fondos oscuros
  onDarkMuted: '#C8B6A6',
  onDarkSoft: '#D0C0B4',
  textPrimary: theme.palette.text.primary,
  textSecondary: theme.palette.text.secondary,
};

export default theme;
