// ─── Espaciado de CoffeeFast ─────────────────────────────────────
// Sistema de espaciado basado en múltiplos de 4px.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ─── Radios de borde ─────────────────────────────────────────────
// S2-T1: escala única para que botones, tarjetas, inputs y contenedores
// compartan los mismos radios. Los valores son los que ya se usaban.
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  // S2-T2: radio de 24px que ya usaban las tarjetas de cafetería y los
  // estados (vacío/error). Se agrega como token aditivo para no dejar el
  // número hardcodeado, sin cambiar ningún valor visual.
  xxl: 24,
  pill: 999,
};

export default spacing;
