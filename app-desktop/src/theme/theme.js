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

export default theme;