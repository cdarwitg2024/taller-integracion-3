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

export default theme;
