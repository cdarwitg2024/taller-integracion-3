// ─── Punto de entrada del tema ───────────────────────────────────
// Permite importar todo el sistema de diseño desde un único lugar:
//
//   import { colors, spacing, radius, typography, lineHeight } from '../theme';
//
// Re-exporta los archivos del tema sin cambiar sus rutas originales
// (`../theme/colors`, `../theme/spacing`, `../theme/typography` siguen
// funcionando igual).

export { colors } from './colors';
export { spacing, radius } from './spacing';
export { typography, lineHeight } from './typography';
