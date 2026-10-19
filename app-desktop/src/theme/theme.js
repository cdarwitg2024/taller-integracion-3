import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4A3B32',
    },
    secondary: {
      main: '#C8B2A1',
    },
    background: {
      default: '#FAF7F5',
      paper: '#FFFFFF',
    },
    success: {
      main: '#2E7D32',
    },
    warning: {
      main: '#E65100',
    },
    text: {
      primary: '#4A3B32',
      secondary: '#78665B',
    },
    divider: '#EFEAE6',
  },

  typography: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',

    h1: {
      fontFamily: '"Playfair Display", serif',
    },

    h2: {
      fontFamily: '"Playfair Display", serif',
    },

    h3: {
      fontFamily: '"Playfair Display", serif',
    },

    h4: {
      fontFamily: '"Playfair Display", serif',
    },

    h5: {
      fontFamily: '"Playfair Display", serif',
    },

    h6: {
      fontFamily: '"Playfair Display", serif',
    },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
          fontSize: '1rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            minHeight: 48,
          },
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