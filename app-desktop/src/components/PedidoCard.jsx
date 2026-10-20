// ─── Componente: Tarjeta de Pedido (KDS / Panel Dueño) ──────────────────────
// Tarjeta de pedido normalizada para la cocina y panel administrativo.
// Usa BaseCard, BaseButton, BaseBadge y tokens de diseño compartidos.

import { Box, Chip, Divider, Stack, Tooltip, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import TimeAgo from './TimeAgo';
import { parsearFecha, formatearHora } from '../utils/dateUtils';
import impresionService from '../services/impresionService';

import BaseCard from './ui/BaseCard';
import BaseButton from './ui/BaseButton';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

const BORDER = {
  radiusMd: 10,
};

const etiquetaPorEstado = {
  pendiente: { fondo: COLORS.warningBg, texto: COLORS.warning, label: 'PENDIENTE' },
  preparando: { fondo: COLORS.warningBg, texto: COLORS.warning, label: 'EN PREPARACIÓN' },
  en_preparacion: { fondo: COLORS.warningBg, texto: COLORS.warning, label: 'EN PREPARACIÓN' },
  listo: { fondo: COLORS.infoBg, texto: COLORS.info, label: 'LISTO PARA RETIRO' },
};

const botonPorEstado = {
  pendiente: { label: 'COMENZAR PREPARACIÓN', background: COLORS.primary, siguiente: 'en_preparacion' },
  preparando: { label: 'MARCAR COMO LISTO', background: COLORS.warning, siguiente: 'listo' },
  en_preparacion: { label: 'MARCAR COMO LISTO', background: COLORS.warning, siguiente: 'listo' },
};

function getHoraRetiro(pedido) {
  if (pedido.hora_retiro) return formatearHora(pedido.hora_retiro);
  if (pedido.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) {
      return formatearHora(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  const etiqueta = etiquetaPorEstado[pedido.estado];
  const boton = botonPorEstado[pedido.estado];
  const horaRetiro = getHoraRetiro(pedido);
  const estadoImpresion = impresionService.getEstadoImpresion(pedido.rawId ?? pedido.id);

  return (
    <BaseCard
      variant="elevated"
      padding="none"
      sx={{
        cursor: 'pointer',
        '&:active': { transform: 'scale(0.99)' },
        mb: SPACING.md,
      }}
      onClick={() => onOpen(pedido)}
    >
      <Box sx={{ p: SPACING.lg }}>
        <Stack direction="row" sx={{ mb: SPACING.sm, justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={TYPOGRAPHY.fontWeightExtraBold} sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' } }}>
                {pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`}
              </Typography>
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
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: TYPOGRAPHY.fontWeightBold,
                      backgroundColor: estadoImpresion.veces > 1 ? COLORS.warningBg : '#EFEBE9',
                      color: estadoImpresion.veces > 1 ? COLORS.warning : '#5D4037',
                    }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
              {pedido.cafeteria_nombre || pedido.ubicacion || ''}
              {pedido.franja_retiro ? ` · Retiro ${pedido.franja_retiro}` : ''}
            </Typography>
          </Box>
          <TimeAgo pedido={pedido} sx={{ fontSize: '1.15rem', fontWeight: TYPOGRAPHY.fontWeightExtraBold }} />
        </Stack>

        <Stack direction="row" sx={{ mt: SPACING.md, justifyContent: 'space-between', alignItems: 'center' }}>
          {etiqueta && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                px: SPACING.lg,
                borderRadius: BORDER.radiusMd,
                backgroundColor: etiqueta.fondo,
                color: etiqueta.texto,
                fontWeight: TYPOGRAPHY.fontWeightExtraBold,
                letterSpacing: 0.5,
                fontSize: '1.05rem',
              }}
            >
              {etiqueta.label}
            </Box>
          )}

          <Typography
            fontWeight={TYPOGRAPHY.fontWeightExtraBold}
            sx={{ color: COLORS.textPrimary, whiteSpace: 'nowrap', fontSize: '1.15rem' }}
          >
            🕐 {horaRetiro}
          </Typography>
        </Stack>

        <Divider sx={{ my: SPACING.md }} />

        <Box sx={{ maxHeight: 170, overflowY: 'auto' }}>
          {pedido.productos?.map((item, idx) => (
            <Typography
              key={idx}
              fontWeight={TYPOGRAPHY.fontWeightBold}
              sx={{ fontSize: '1.2rem', color: COLORS.textPrimary, lineHeight: TYPOGRAPHY.lineHeightRelaxed }}
            >
              {item.nombre} × {item.cantidad}
            </Typography>
          )) || <Typography sx={{ color: COLORS.textSecondary }}>Sin productos</Typography>}
        </Box>
      </Box>

      {boton && (
        <Box sx={{ px: SPACING.lg, pb: SPACING.lg, pt: 0 }}>
          <BaseButton
            variant="primary"
            fullWidth
            onClick={(e) => onChangeEstado(pedido.rawId ?? pedido.id, boton.siguiente, e)}
            sx={{
              minHeight: 56,
              minWidth: 56,
              fontSize: '1.05rem',
              fontWeight: TYPOGRAPHY.fontWeightExtraBold,
              letterSpacing: 0.5,
              '&:hover': {
                filter: 'brightness(0.92)',
              },
            }}
          >
            {boton.label}
          </BaseButton>
        </Box>
      )}
    </BaseCard>
  );
}

export default PedidoCard;
