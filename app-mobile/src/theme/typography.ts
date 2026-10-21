// ─── Tipografía de CoffeeFast ────────────────────────────────────
// Sistema de tipografía con pesos, tamaños y line-heights consistentes.

import { Platform } from 'react-native';

export const typography = {
  // Familias
  familia: 'serif',
  familiaSecundaria: 'sans-serif',
  // Fuente serif con la que se renderizan títulos en iOS (Georgia) y el
  // fallback genérico en Android. Centralizada para no repetir el ternario
  // de Platform en cada pantalla.
  familiaTitulo: Platform.OS === 'ios' ? 'Georgia' : 'serif',

  // Pesos (fontWeight de React Native)
  pesoNormal: '400',
  pesoMedio: '600',
  pesoBold: '700',
  pesoExtraBold: '800',

  // Tamaños
  tituloGrande: 28,
  titulo: 20,
  subtitulo: 16,
  cuerpo: 14,
  cuerpoPequeno: 12,
  etiqueta: 10,
  micro: 8,
} as const;

// ─── Alturas de línea ────────────────────────────────────────────
// S2-T1: valores de `lineHeight` que ya se usaban en las pantallas, para
// que el texto respire igual en toda la app.
export const lineHeight = {
  tituloGrande: 34,
  titulo: 26,
  subtitulo: 22,
  cuerpo: 20,
  cuerpoPequeno: 18,
  etiqueta: 14,
} as const;

export default typography;
