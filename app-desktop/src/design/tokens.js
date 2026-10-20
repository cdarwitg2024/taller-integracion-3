// ─── Tokens de diseño — Panel Administrativo CoffeeFast ─────────────────────
// Única fuente de verdad para colores, espaciado, tipografía, bordes y sombras.

export const COLORS = {
  // Primarios (café)
  primary: '#4A3B32',
  primaryHover: '#38281E',
  primaryLight: '#F5EDE4',

  // Secundarios
  secondary: '#C8B2A1',
  secondaryLight: '#FAF2EA',

  // Fondos
  background: '#FAF7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F5F2',

  // Estados
  success: '#2E7D32',
  successBg: '#E8F5E9',
  warning: '#E65100',
  warningBg: '#FFF3E0',
  error: '#C62828',
  errorBg: '#FFEBEE',
  info: '#00695C',
  infoBg: '#E0F2F1',

  // Textos
  textPrimary: '#4A3B32',
  textSecondary: '#78665B',
  textMuted: '#8C7A6F',
  textOnPrimary: '#FFFFFF',

  // Bordes y divisores
  border: '#EFEAE6',
  borderFocus: '#4A3B32',

  // Sombras
  shadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
  shadowHover: '0 6px 16px rgba(74, 55, 40, 0.08)',
  shadowStrong: '0 8px 24px rgba(74, 59, 50, 0.14)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const TYPOGRAPHY = {
  // Familias
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontFamilySerif: '"Playfair Display", serif',

  // Tamaños (rem)
  h1: '2.5rem',
  h2: '2rem',
  h3: '1.75rem',
  h4: '1.5rem',
  h5: '1.25rem',
  h6: '1.1rem',
  body1: '1rem',
  body2: '0.875rem',
  caption: '0.75rem',
  overline: '0.7rem',

  // Pesos
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  fontWeightExtraBold: 800,

  // Altura de línea
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.6,
};

export const BORDER = {
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 12,
  radiusXl: 16,
  radiusFull: '9999px',
  width: 1,
  color: '#EFEAE6',
};

export const SHADOWS = {
  sm: '0 2px 10px rgba(74, 55, 40, 0.04)',
  md: '0 6px 16px rgba(74, 55, 40, 0.08)',
  lg: '0 8px 24px rgba(74, 59, 50, 0.14)',
};

export const COMPONENT = {
  // Alturas mínimas
  minHeightButton: 48,
  minHeightInput: 48,
  minHeightIconButton: 48,
  minHeightListItem: 56,
  minHeightTab: 48,

  // Padding interno típico
  cardPadding: 16,
  cardPaddingLg: 24,
  sectionMarginBottom: 20,
};

export default {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  BORDER,
  SHADOWS,
  COMPONENT,
};
