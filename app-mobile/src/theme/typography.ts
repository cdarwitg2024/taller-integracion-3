// ─── Tipografía de CoffeeFast ────────────────────────────────────
// Sistema de tipografía con pesos y tamaños consistentes

export const typography = {
  // Familias
  familia: 'serif',
  familiaSecundaria: 'sans-serif',

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

export default typography;
