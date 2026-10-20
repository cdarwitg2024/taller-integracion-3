// ─── Componente: Tarjetas KPI (Panel Dueño) ─────────────────────────────────
// Tarjetas de indicadores principales con diseño normalizado.

import { Grid, Box, Typography } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import BaseCard from '../ui/BaseCard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER } from '../../design/tokens';

// Nota: en `sx`, un número de SPACING se multiplica ×8 (theme.spacing), así que
// un margen de 24px quedaría como 192px. Convertimos a string px explícito.
const px = (valor) => `${valor}px`;

const ICON_CONFIG = {
  ventas: { icon: <AttachMoneyIcon sx={{ fontSize: 32 }} />, bg: COLORS.successBg, color: COLORS.success, border: COLORS.success },
  pedidos: { icon: <ShoppingBagIcon sx={{ fontSize: 30 }} />, bg: COLORS.secondaryLight, color: COLORS.primary, border: COLORS.primary },
  pendientes: { icon: <PendingActionsIcon sx={{ fontSize: 30 }} />, bg: COLORS.warningBg, color: COLORS.warning, border: COLORS.warning },
  tiempo: { icon: <AccessTimeIcon sx={{ fontSize: 30 }} />, bg: '#EFEBE9', color: COLORS.textSecondary, border: COLORS.border },
};

function KpiCards({ stats }) {
  const tiempoProm = stats?.tiempoPromedioMin && Number(stats.tiempoPromedioMin) > 0
    ? `${stats.tiempoPromedioMin} min`
    : '0 min';

  const cards = [
    {
      id: 'ventas',
      title: 'Ventas del Día',
      value: `$${(stats?.totalVentas || 0).toLocaleString('es-CL')}`,
      subtitle: (stats?.totalVentas || 0) > 0 ? 'Total facturado en la jornada' : 'Sin ventas registradas hoy',
      ...ICON_CONFIG.ventas,
    },
    {
      id: 'pedidos',
      title: 'Total Pedidos',
      value: stats?.totalPedidos || 0,
      subtitle: 'Registrados en el turno',
      ...ICON_CONFIG.pedidos,
    },
    {
      id: 'pendientes',
      title: 'Pendientes / En Prep.',
      value: (stats?.pendientes || 0) + (stats?.preparando || 0),
      subtitle: `${stats?.pendientes || 0} pendientes • ${stats?.preparando || 0} en prep.`,
      ...ICON_CONFIG.pendientes,
    },
    {
      id: 'tiempo',
      title: 'Tiempo Prom. Prep.',
      value: tiempoProm,
      subtitle: 'Promedio real de atención',
      ...ICON_CONFIG.tiempo,
    },
  ];

  return (
    <Grid container spacing={3} sx={{ width: '100%', mb: px(SPACING.xxl) }}>
      {cards.map((card) => (
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 3 }} key={card.id}>
          <BaseCard variant="elevated" padding="lg">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: px(SPACING.sm),
                  mb: px(SPACING.md),
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    fontWeight={TYPOGRAPHY.fontWeightBold}
                    sx={{
                      color: COLORS.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {card.title}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={TYPOGRAPHY.fontWeightExtraBold}
                    sx={{
                      color: COLORS.textPrimary,
                      mt: px(SPACING.xs),
                      letterSpacing: '-0.5px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: COLORS.textSecondary, mt: px(SPACING.xs) }}>
                    {card.subtitle}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: BORDER.radiusMd,
                    backgroundColor: card.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </Box>
              </Box>
            </Box>
          </BaseCard>
        </Grid>
      ))}
    </Grid>
  );
}

export default KpiCards;
