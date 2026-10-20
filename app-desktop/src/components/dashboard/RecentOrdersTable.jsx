// ─── Componente: Tabla de Últimos Pedidos ────────────────────────────────────
// Tabla normalizada para el dashboard del dueño. Usa componentes base y tokens.

import { Box, Typography, Chip } from '@mui/material';
import { formatearHora } from '../../utils/dateUtils';

import {
  BaseTableContainer,
  BaseTable,
  BaseTableHead,
  BaseTableBody,
  BaseTableCell,
  BaseTableRow,
} from '../ui/BaseTable';
import BaseBadge from '../ui/BaseBadge';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

const ESTADO_CONFIG = {
  pendiente: { label: 'PENDIENTE', bg: COLORS.errorBg, color: COLORS.error },
  preparando: { label: 'EN PREPARACIÓN', bg: COLORS.warningBg, color: COLORS.warning },
  en_preparacion: { label: 'EN PREPARACIÓN', bg: COLORS.warningBg, color: COLORS.warning },
  listo: { label: 'LISTO', bg: COLORS.infoBg, color: COLORS.info },
  entregado: { label: 'ENTREGADO', bg: COLORS.successBg, color: COLORS.success },
};

function getEstadoChip(estado) {
  const config = ESTADO_CONFIG[estado] || {
    label: String(estado).toUpperCase(),
    bg: '#F5F5F5',
    color: '#616161',
  };

  return (
    <BaseBadge
      estado={estado}
      sx={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: '0.72rem',
        fontWeight: TYPOGRAPHY.fontWeightBold,
        borderRadius: '6px',
        minHeight: 28,
      }}
    />
  );
}

function RecentOrdersTable({ pedidos }) {
  const displayPedidos = pedidos && pedidos.length > 0 ? pedidos.slice(0, 6) : [];

  return (
    <BaseTableContainer
      sx={{
        height: '100%',
        minHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ p: SPACING.lg, pb: SPACING.md }}>
        <Typography variant="h6" fontWeight={TYPOGRAPHY.fontWeightBold} sx={{ color: COLORS.textPrimary, fontSize: '1.1rem' }}>
          Últimos Pedidos Registrados
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
          Actividad reciente en el punto de venta
        </Typography>
      </Box>

      <BaseTable>
        <BaseTableHead>
          <BaseTableRow>
            <BaseTableCell variant="head">CÓDIGO / ID</BaseTableCell>
            <BaseTableCell variant="head">CLIENTE</BaseTableCell>
            <BaseTableCell variant="head">UBICACIÓN / SEDE</BaseTableCell>
            <BaseTableCell variant="head">HORA</BaseTableCell>
            <BaseTableCell variant="head">TOTAL</BaseTableCell>
            <BaseTableCell variant="head">ESTADO</BaseTableCell>
          </BaseTableRow>
        </BaseTableHead>
        <BaseTableBody>
          {displayPedidos.length === 0 ? (
            <BaseTableRow>
              <BaseTableCell colSpan={6} align="center" sx={{ py: SPACING.xl, color: COLORS.textMuted }}>
                No hay pedidos registrados recientemente.
              </BaseTableCell>
            </BaseTableRow>
          ) : (
            displayPedidos.map((p) => {
              const userObj = p.usuarios || p.USUARIOS;
              const clienteNombre =
                p.cliente ||
                (userObj ? `${userObj.nombre || ''} ${userObj.apellido || ''}`.trim() : 'Cliente General');
              const cafeObj = p.cafeterias || p.CAFETERIAS;
              const ubicacionNombre =
                p.ubicacion ||
                (cafeObj?.nombre ? cafeObj.nombre : 'Campus Central');
              const horaFormat = formatearHora(p.creado_en || p.hora);

              return (
                <BaseTableRow key={p.id} hover sx={{ borderColor: `${COLORS.border} !important` }}>
                  <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textPrimary, fontSize: '0.85rem' }}>
                    {p.codigo_pedido || `#${p.id}`}
                  </BaseTableCell>
                  <BaseTableCell sx={{ color: COLORS.textPrimary, fontSize: '0.85rem', fontWeight: TYPOGRAPHY.fontWeightMedium }}>
                    {clienteNombre}
                  </BaseTableCell>
                  <BaseTableCell sx={{ color: COLORS.textSecondary, fontSize: '0.82rem' }}>
                    {ubicacionNombre}
                  </BaseTableCell>
                  <BaseTableCell sx={{ color: COLORS.textSecondary, fontSize: '0.82rem' }}>
                    {horaFormat}
                  </BaseTableCell>
                  <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textPrimary, fontSize: '0.85rem' }}>
                    ${(p.total || 0).toLocaleString('es-CL')}
                  </BaseTableCell>
                  <BaseTableCell>
                    {getEstadoChip(p.estado)}
                  </BaseTableCell>
                </BaseTableRow>
              );
            })
          )}
        </BaseTableBody>
      </BaseTable>
    </BaseTableContainer>
  );
}

export default RecentOrdersTable;
