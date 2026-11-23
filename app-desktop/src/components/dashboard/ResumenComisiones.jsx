// Resumen de ventas referidas, cobro y comisiones por estado del panel del dueño.
import { Grid, Typography } from '@mui/material';

import BaseCard from '../ui/BaseCard';
import {
  BaseTableContainer,
  BaseTable,
  BaseTableHead,
  BaseTableBody,
  BaseTableRow,
  BaseTableCell,
} from '../ui/BaseTable';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

const pesos = (valor) => `$${(Number(valor) || 0).toLocaleString('es-CL')}`;

function ResumenComisiones({ resumen }) {
  const datos = resumen || {};
  const comisiones = datos.comisiones || {};
  const movimientos = datos.movimientos || [];
  const totales = [
    { id: 'referidas', titulo: 'Ventas referidas', valor: datos.ventasReferidas || 0 },
    { id: 'cobrado', titulo: 'Total cobrado', valor: pesos(datos.totalCobrado) },
    { id: 'pendiente', titulo: 'Comisión pendiente', valor: pesos(comisiones.pendiente) },
    { id: 'disponible', titulo: 'Comisión disponible', valor: pesos(comisiones.disponible) },
    { id: 'revertida', titulo: 'Comisión revertida', valor: pesos(comisiones.revertida) },
    { id: 'reversiones', titulo: 'Reversiones', valor: pesos(datos.reversiones) },
  ];

  return (
    <BaseCard variant="elevated" padding="lg" sx={{ mb: `${SPACING.xxl}px` }}>
      <Typography variant="h6" fontWeight={TYPOGRAPHY.fontWeightBold} sx={{ color: COLORS.textPrimary, mb: `${SPACING.md}px` }}>
        Resumen de ventas y comisiones
      </Typography>
      <Grid container spacing={2} sx={{ mb: movimientos.length ? `${SPACING.lg}px` : 0 }}>
        {totales.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
            <Typography variant="caption" sx={{ color: COLORS.textMuted, textTransform: 'uppercase' }}>
              {item.titulo}
            </Typography>
            <Typography variant="h6" fontWeight={TYPOGRAPHY.fontWeightExtraBold} sx={{ color: COLORS.textPrimary }}>
              {item.valor}
            </Typography>
          </Grid>
        ))}
      </Grid>
      {movimientos.length > 0 && (
        <BaseTableContainer>
          <BaseTable size="small">
            <BaseTableHead>
              <BaseTableRow>
                <BaseTableCell variant="head">Pedido</BaseTableCell>
                <BaseTableCell variant="head">Tipo</BaseTableCell>
                <BaseTableCell variant="head">Estado</BaseTableCell>
                <BaseTableCell variant="head" align="right">Monto</BaseTableCell>
              </BaseTableRow>
            </BaseTableHead>
            <BaseTableBody>
              {movimientos.map((movimiento) => (
                <BaseTableRow key={movimiento.id}>
                  <BaseTableCell>#{movimiento.pedidoId}</BaseTableCell>
                  <BaseTableCell>{movimiento.tipo}</BaseTableCell>
                  <BaseTableCell>{movimiento.estado}</BaseTableCell>
                  <BaseTableCell align="right">{pesos(movimiento.montoClp)}</BaseTableCell>
                </BaseTableRow>
              ))}
            </BaseTableBody>
          </BaseTable>
        </BaseTableContainer>
      )}
    </BaseCard>
  );
}

export default ResumenComisiones;
