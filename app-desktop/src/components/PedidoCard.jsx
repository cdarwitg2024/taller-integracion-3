// ─── Componente: Tarjeta de Pedido (KDS / Panel Dueño) ──────────────────────
// Tarjeta de pedido normalizada para la cocina y panel administrativo.
//
// Muestra de un vistazo: código del pedido, estado, horario de retiro, productos
// y la acción disponible para ese estado. El color del acento lateral, el chip de
// estado y la cantidad de cada producto salen de BaseBadge/tokens, que es la
// fuente única de verdad: así el KDS y el panel de dueño usan los mismos colores
// para el mismo estado.
//
// IMPORTANTE (2 detalles de MUI v9 / sx):
//  1. Los tokens SPACING vienen en px reales (12 = 12px), pero dentro de `sx` los
//     números se multiplican por theme.spacing (×8). Por eso se pasan con `px()`
//     como string: si no, `px: SPACING.md` se aplicaba como 96px y la tarjeta
//     desbordaba.
//  2. Los contenedores flex se declaran con `sx` (y no con los props `flexWrap` /
//     `justifyContent` de Stack), que en esta versión se filtran al DOM sin
//     aplicarse.
//
// Todos los bloques usan `minWidth: 0` + recorte de texto, para que la tarjeta
// se adapte a columnas angostas (ventana chica, muchas columnas) en vez de
// desbordar y quedar cortada.

import { Box, Chip, Divider, Tooltip, Typography } from '@mui/material';
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

// Los tokens SPACING son px reales; en `sx` hay que declararlos como string.
const px = (valor) => `${valor}px`;

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

// Contenedor flex declarado con sx: envuelve en pantallas angostas y respeta
// los gaps, sin depender de props de Stack que esta versión de MUI no aplica.
const filaFlex = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: px(SPACING.sm),
  minWidth: 0,
};

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  const configEstado = getEstadoConfig(pedido.estado);
  const accion = ACCION_POR_ESTADO[pedido.estado];
  const horaRetiro = horaRetiroPedido(pedido);
  const estadoImpresion = impresionService.getEstadoImpresion(pedido.rawId ?? pedido.id);
  const nombreCafeteria = pedido.cafeteria_nombre || pedido.ubicacion || '';

  // Texto del horario de retiro, con fallback claro cuando no hay hora exacta.
  const textoRetiro = horaRetiro ? `Retiro ${horaRetiro}` : 'Sin hora de retiro';

  return (
    <BaseCard
      padding="none"
      sx={{
        cursor: 'pointer',
        mb: px(SPACING.md),
        // `display: block` + `minWidth: 0`: la tarjeta y sus bloques se ajustan
        // al ancho de la columna en vez de quedarse en su ancho natural.
        display: 'block',
        boxSizing: 'border-box',
        maxWidth: '100%',
        minWidth: 0,
        // Acento de color: identifica el estado sin tener que leer el chip.
        borderLeft: `6px solid ${configEstado.color}`,
        '&:hover': { boxShadow: '0 6px 16px rgba(74, 55, 40, 0.08)' },
        '&:active': { transform: 'scale(0.99)' },
      }}
      onClick={() => onOpen(pedido)}
    >
      {/* Cabecera: código + estado + tiempo transcurrido */}
      <Box
        sx={{
          boxSizing: 'border-box',
          maxWidth: '100%',
          px: px(SPACING.lg),
          pt: px(SPACING.md),
          pb: px(SPACING.sm),
        }}
      >
        <Box sx={{ ...filaFlex, justifyContent: 'space-between' }}>
          <Typography
            variant="h5"
            sx={{
              minWidth: 0,
              fontSize: { xs: '1.2rem', md: '1.55rem' },
              fontWeight: TYPOGRAPHY.fontWeightExtraBold,
              color: COLORS.textPrimary,
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: px(SPACING.xs),
              minWidth: 0,
            }}
          >
            <BaseBadge
              estado={pedido.estado}
              sx={{
                maxWidth: '100%',
                // En tarjetas angostas el rótulo se recorta en vez de desbordar.
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />

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
          </Box>

          <TimeAgo
            pedido={pedido}
            sx={{
              flexShrink: 0,
              ml: 'auto',
              fontSize: { xs: '0.95rem', md: '1.15rem' },
              fontWeight: TYPOGRAPHY.fontWeightExtraBold,
              color: COLORS.textPrimary,
            }}
          />
        </Box>

        {/* Cafetería · horario de retiro (una sola línea, se recorta si no cabe) */}
        <Box sx={{ ...filaFlex, gap: px(SPACING.xs), mt: px(SPACING.xs) }}>
          <AccessTimeIcon
            sx={{
              flexShrink: 0,
              fontSize: { xs: 16, md: 18 },
              color: horaRetiro ? configEstado.color : COLORS.textSecondary,
            }}
          />
          <Typography
            variant="caption"
            title={`${nombreCafeteria} · ${textoRetiro}`}
            sx={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: COLORS.textSecondary,
              fontWeight: TYPOGRAPHY.fontWeightMedium,
            }}
          >
            {nombreCafeteria ? `${nombreCafeteria} · ${textoRetiro}` : textoRetiro}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: COLORS.border }} />

      {/* Productos: cantidad destacada + nombre (máximo 2 líneas) */}
      <Box
        sx={{
          boxSizing: 'border-box',
          maxWidth: '100%',
          px: px(SPACING.lg),
          py: px(SPACING.sm),
          maxHeight: { xs: 110, md: 170 },
          overflowY: 'auto',
          minWidth: 0,
        }}
      >
        {pedido.productos?.length ? (
          pedido.productos.map((item, idx) => (
            <Box key={idx} sx={{ ...filaFlex, alignItems: 'flex-start', py: '2px' }}>
              <Chip
                label={`×${item.cantidad}`}
                size="small"
                sx={{
                  flexShrink: 0,
                  minWidth: 38,
                  height: 24,
                  backgroundColor: configEstado.bg,
                  color: configEstado.color,
                  fontWeight: TYPOGRAPHY.fontWeightExtraBold,
                  fontSize: '0.8rem',
                }}
              />
              <Typography
                sx={{
                  minWidth: 0,
                  fontSize: { xs: '0.95rem', md: '1.1rem' },
                  fontWeight: TYPOGRAPHY.fontWeightBold,
                  color: COLORS.textPrimary,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {item.nombre}
              </Typography>
            </Box>
          ))
        ) : (
          <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
            Sin productos
          </Typography>
        )}
      </Box>

      {/* Acción disponible para el estado actual */}
      <Box
        sx={{
          boxSizing: 'border-box',
          maxWidth: '100%',
          px: px(SPACING.lg),
          pb: px(SPACING.md),
        }}
      >
        {accion ? (
          <BaseButton
            className={`variant-${accion.variante}`}
            endIcon={<accion.Icono sx={{ flexShrink: 0 }} />}
            onClick={(e) => onChangeEstado(pedido.rawId ?? pedido.id, accion.siguiente, e)}
            sx={{
              width: '100%',
              minHeight: { xs: 46, md: 56 },
              px: px(SPACING.sm),
              fontSize: { xs: '0.8rem', md: '1rem' },
              fontWeight: TYPOGRAPHY.fontWeightExtraBold,
              letterSpacing: { xs: 0, md: 0.4 },
              lineHeight: 1.15,
              textAlign: 'center',
              // En columnas angostas el rótulo se parte en 2 líneas limpias
              // (MUI corta el texto por defecto con white-space: nowrap).
              whiteSpace: 'normal',
              // El ícono se oculta en pantallas angostas: si no, el rótulo
              // "PREPARACIÓN" no cabe y se cortaba.
              '& .MuiButton-endIcon': { display: { xs: 'none', md: 'flex' } },
            }}
          >
            {accion.label}
          </BaseButton>
        ) : (
          <BaseButton
            className="variant-outlined"
            startIcon={<VisibilityOutlinedIcon sx={{ flexShrink: 0 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(pedido);
            }}
            sx={{
              width: '100%',
              minHeight: 44,
              px: px(SPACING.sm),
              fontSize: { xs: '0.82rem', md: '0.95rem' },
              fontWeight: TYPOGRAPHY.fontWeightBold,
              lineHeight: 1.15,
              textAlign: 'center',
              whiteSpace: 'normal',
              '& .MuiButton-startIcon': { display: { xs: 'none', md: 'flex' } },
            }}
          >
            VER DETALLE
          </BaseButton>
        )}
      </Box>
    </BaseCard>
  );
}

export default PedidoCard;
