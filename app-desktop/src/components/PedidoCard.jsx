// ─── Componente: Tarjeta de Pedido (KDS / Panel Dueño) ──────────────────────
// Tarjeta de pedido normalizada para la cocina y panel administrativo.
//
// Muestra de un vistazo: código del pedido, estado, hora de retiro, productos y
// la acción disponible para ese estado. El color del acento lateral, el chip de
// estado y la cantidad de cada producto salen de BaseBadge/tokens, que es la
// fuente única de verdad: así el KDS y el panel de dueño usan los mismos
// colores para el mismo estado.

import { Box, Chip, Divider, Stack, Tooltip, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import TimeAgo from './TimeAgo';
import { horaRetiroPedido } from '../utils/dateUtils';
import impresionService from '../services/impresionService';

import BaseCard from './ui/BaseCard';
import BaseButton from './ui/BaseButton';
import BaseBadge, { getEstadoConfig } from './ui/BaseBadge';
import { COLORS, SPACING, TYPOGRAPHY } from '../design/tokens';

// Flujo de estados del pedido y la acción disponible en cada uno:
// pendiente → en_preparacion → listo.
const ACCION_POR_ESTADO = {
  pendiente: {
    label: 'COMENZAR PREPARACIÓN',
    siguiente: 'en_preparacion',
    variante: 'primary',
    Icono: PlayArrowIcon,
  },
  preparando: {
    label: 'MARCAR COMO LISTO',
    siguiente: 'listo',
    variante: 'success',
    Icono: TaskAltIcon,
  },
  en_preparacion: {
    label: 'MARCAR COMO LISTO',
    siguiente: 'listo',
    variante: 'success',
    Icono: TaskAltIcon,
  },
};

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  const configEstado = getEstadoConfig(pedido.estado);
  const accion = ACCION_POR_ESTADO[pedido.estado];
  const horaRetiro = horaRetiroPedido(pedido);
  const estadoImpresion = impresionService.getEstadoImpresion(pedido.rawId ?? pedido.id);

  // Texto del horario de retiro, con fallbacks claros cuando no hay hora exacta.
  const textoRetiro = horaRetiro
    ? `Retiro ${horaRetiro}`
    : pedido.franja_retiro
      ? `Retiro ${pedido.franja_retiro}`
      : 'Sin hora de retiro';

  return (
    <BaseCard
      padding="none"
      sx={{
        cursor: 'pointer',
        mb: SPACING.md,
        // Acento de color: identifica el estado sin tener que leer el chip.
        borderLeft: `6px solid ${configEstado.color}`,
        '&:hover': { boxShadow: '0 6px 16px rgba(74, 55, 40, 0.08)' },
        '&:active': { transform: 'scale(0.99)' },
      }}
      onClick={() => onOpen(pedido)}
    >
      {/* Cabecera: código + estado + tiempo transcurrido */}
      <Box sx={{ px: SPACING.lg, pt: SPACING.lg, pb: SPACING.md }}>
        <Stack direction="row" justifyContent="space-between" spacing={SPACING.sm} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={SPACING.sm} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography
                variant="h5"
                sx={{
                  fontSize: { xs: '1.55rem', md: '1.8rem' },
                  fontWeight: TYPOGRAPHY.fontWeightExtraBold,
                  color: COLORS.textPrimary,
                  lineHeight: 1.1,
                }}
              >
                {pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`}
              </Typography>

              <BaseBadge estado={pedido.estado} />

              {estadoImpresion.veces > 0 && (
                <Tooltip
                  title={
                    estadoImpresion.veces > 1
                      ? `Comanda reimpresa (${estadoImpresion.veces} veces)`
                      : 'Comanda impresa para cocina'
                  }
                >
                  <Chip
                    size="small"
                    icon={<PrintIcon sx={{ fontSize: '13px !important' }} />}
                    label={estadoImpresion.veces > 1 ? `×${estadoImpresion.veces}` : 'Impresa'}
                    sx={{
                      height: 24,
                      fontSize: '0.75rem',
                      fontWeight: TYPOGRAPHY.fontWeightBold,
                      backgroundColor: estadoImpresion.veces > 1 ? COLORS.warningBg : COLORS.surfaceAlt,
                      color: estadoImpresion.veces > 1 ? COLORS.warning : COLORS.textSecondary,
                    }}
                  />
                </Tooltip>
              )}
            </Stack>

            <Typography variant="caption" sx={{ color: COLORS.textSecondary, display: 'block', mt: 0.5 }}>
              {pedido.cafeteria_nombre || pedido.ubicacion || ''}
            </Typography>
          </Box>

          <TimeAgo
            pedido={pedido}
            sx={{ fontSize: '1.15rem', fontWeight: TYPOGRAPHY.fontWeightExtraBold, color: COLORS.textPrimary }}
          />
        </Stack>

        {/* Horario de retiro */}
        <Stack direction="row" alignItems="center" spacing={SPACING.sm} sx={{ mt: SPACING.sm }}>
          <AccessTimeIcon sx={{ fontSize: 22, color: horaRetiro ? configEstado.color : COLORS.textSecondary }} />
          <Typography
            sx={{
              fontSize: '1.15rem',
              fontWeight: TYPOGRAPHY.fontWeightBold,
              color: horaRetiro ? COLORS.textPrimary : COLORS.textSecondary,
            }}
          >
            {textoRetiro}
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: COLORS.border }} />

      {/* Productos: cantidad destacada + nombre */}
      <Box sx={{ px: SPACING.lg, py: SPACING.md, maxHeight: 170, overflowY: 'auto' }}>
        {pedido.productos?.length ? (
          pedido.productos.map((item, idx) => (
            <Stack key={idx} direction="row" alignItems="center" spacing={SPACING.sm} sx={{ py: 0.5 }}>
              <Chip
                label={`×${item.cantidad}`}
                size="small"
                sx={{
                  minWidth: 44,
                  height: 26,
                  flexShrink: 0,
                  backgroundColor: configEstado.bg,
                  color: configEstado.color,
                  fontWeight: TYPOGRAPHY.fontWeightExtraBold,
                  fontSize: '0.85rem',
                }}
              />
              <Typography
                sx={{ fontSize: '1.2rem', fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textPrimary }}
              >
                {item.nombre}
              </Typography>
            </Stack>
          ))
        ) : (
          <Typography sx={{ color: COLORS.textSecondary }}>Sin productos</Typography>
        )}
      </Box>

      {/* Acción disponible para el estado actual */}
      <Box sx={{ px: SPACING.lg, pb: SPACING.lg }}>
        {accion ? (
          <BaseButton
            className={`variant-${accion.variante}`}
            fullWidth
            endIcon={<accion.Icono />}
            onClick={(e) => onChangeEstado(pedido.rawId ?? pedido.id, accion.siguiente, e)}
            sx={{
              minHeight: 60,
              fontSize: '1.05rem',
              fontWeight: TYPOGRAPHY.fontWeightExtraBold,
              letterSpacing: 0.5,
            }}
          >
            {accion.label}
          </BaseButton>
        ) : (
          <BaseButton
            className="variant-outlined"
            fullWidth
            startIcon={<VisibilityOutlinedIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(pedido);
            }}
            sx={{ minHeight: 52, fontSize: '1rem', fontWeight: TYPOGRAPHY.fontWeightBold }}
          >
            VER DETALLE
          </BaseButton>
        )}
      </Box>
    </BaseCard>
  );
}

export default PedidoCard;
