// ─── Componente: Badge de Estado ────────────────────────────────────────────
// Badge normalizado para estados de pedido en todo el panel administrativo.
// Usa BaseBadge y los tokens de diseño compartidos.

import BaseBadge from '../ui/BaseBadge';

function EstadoChip({ estado }) {
  return <BaseBadge estado={estado} />;
}

export default EstadoChip;
