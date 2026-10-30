// ─── Pantalla: Promociones (Panel Dueño) ──────────────────────────────────────
// Gestión de promociones activas de la cafetería.
// Accesible solo para usuarios con rol "dueño".
//
// Flujo:
//   1. app.jsx define la ruta /dueno/promociones y el ítem del menú.
//   2. Sidebar renderiza el ítem "Promociones".
//   3. Al hacer clic, se renderiza este componente dentro de AppLayout.
//   4. AppLayout inyecta automáticamente el PageHeader consistente (título y subtítulo).

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  CardContent,
  Stack,
  TableRow,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

import BaseCard from '../../components/ui/BaseCard';
import BaseButton from '../../components/ui/BaseButton';
import Input from '../../components/ui/BaseInput';
import {
  BaseTableContainer,
  BaseTable,
  BaseTableHead,
  BaseTableBody,
  BaseTableCell,
} from '../../components/ui/BaseTable';
import {
  BaseDialog,
  BaseDialogTitle,
  BaseDialogContent,
  BaseDialogActions,
} from '../../components/ui/BaseDialog';
import { COLORS, SPACING, TYPOGRAPHY, BORDER } from '../../design/tokens';

const initialPromociones = [
  { id: 1, nombre: 'Café Americano 2x1', descripcion: 'Lunes y martes de 7:00 a 10:00', descuento: '50%', activo: true },
  { id: 2, nombre: 'Combo Desayuno', descripcion: 'Café + medialuna + jugo', descuento: '20%', activo: true },
  { id: 3, nombre: 'Tarde de Té', descripcion: 'Té + pastelería desde las 16:00', descuento: '30%', activo: false },
];

export default function Promociones({ currentUser }) {
  const [promociones, setPromociones] = useState(initialPromociones);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promocionAEliminar, setPromocionAEliminar] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', descuento: '', activo: true });

  const total = promociones.length;
  const activas = promociones.filter((p) => p.activo).length;
  const inactivas = total - activas;

  const handleOpenDialog = () => {
    setForm({ nombre: '', descripcion: '', descuento: '', activo: true });
    setEditing(false);
    setDialogOpen(true);
  };

  const handleEdit = (p) => {
    setForm({ ...p });
    setEditing(true);
    setDialogOpen(true);
  };

  const handleConfirmDelete = (p) => {
    setPromocionAEliminar(p);
    setDeleteDialogOpen(true);
  };

  const handleDeleteExecute = () => {
    if (promocionAEliminar) {
      setPromociones(promociones.filter((p) => p.id !== promocionAEliminar.id));
    }
    setDeleteDialogOpen(false);
    setPromocionAEliminar(null);
  };

  const handleSave = () => {
    if (!form.nombre || !form.descuento) return;

    if (editing) {
      setPromociones(
        promociones.map((p) => (p.id === form.id ? { ...p, ...form } : p))
      );
    } else {
      const newId = Math.max(...promociones.map((p) => p.id), 0) + 1;
      setPromociones([...promociones, { ...form, id: newId }]);
    }
    setDialogOpen(false);
  };

  return (
    <Box sx={{ width: '100%', pb: SPACING.xxxl }}>
      
      {/* Barra de Acción Superior (El título y subtítulo los inyecta AppLayout con PageHeader) */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          width: '100%',
          mb: SPACING.lg,
        }}
      >
        <BaseButton
          className="variant-primary"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Agregar Promoción
        </BaseButton>
      </Box>

      {/* Tarjetas de Resumen (KPIs compactos reutilizando BaseCard y tokens de diseño) */}
      <Grid container spacing={2.5} sx={{ width: '100%', mb: SPACING.lg }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <BaseCard padding="md" sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <CardContent sx={{ p: 0, width: '100%', '&:last-child': { pb: 0 } }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: `${BORDER.radiusMd}px`,
                    bgcolor: COLORS.primaryLight,
                    color: COLORS.primary,
                    display: 'flex',
                  }}
                >
                  <LocalOfferOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: TYPOGRAPHY.fontWeightSemibold }}>
                    Total Promociones
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: TYPOGRAPHY.fontWeightExtraBold, color: COLORS.textPrimary }}>
                    {total}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </BaseCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <BaseCard
            padding="md"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              bgcolor: COLORS.successBg,
              border: `1px solid ${COLORS.success}`,
            }}
          >
            <CardContent sx={{ p: 0, width: '100%', '&:last-child': { pb: 0 } }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: `${BORDER.radiusMd}px`,
                    bgcolor: 'rgba(46, 125, 50, 0.12)',
                    color: COLORS.success,
                    display: 'flex',
                  }}
                >
                  <CheckCircleOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: COLORS.success, fontWeight: TYPOGRAPHY.fontWeightSemibold }}>
                    Promociones Activas
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: TYPOGRAPHY.fontWeightExtraBold, color: COLORS.success }}>
                    {activas}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </BaseCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <BaseCard
            padding="md"
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              bgcolor: COLORS.errorBg,
              border: `1px solid ${COLORS.error}`,
            }}
          >
            <CardContent sx={{ p: 0, width: '100%', '&:last-child': { pb: 0 } }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: `${BORDER.radiusMd}px`,
                    bgcolor: 'rgba(198, 40, 40, 0.12)',
                    color: COLORS.error,
                    display: 'flex',
                  }}
                >
                  <ErrorOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: COLORS.error, fontWeight: TYPOGRAPHY.fontWeightSemibold }}>
                    Promociones Inactivas
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: TYPOGRAPHY.fontWeightExtraBold, color: COLORS.error }}>
                    {inactivas}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </BaseCard>
        </Grid>
      </Grid>

      {/* Tabla Principal de Promociones (Usando componentes compartidos BaseTable) */}
      <BaseTableContainer>
        <BaseTable size="small">
          <BaseTableHead>
            <TableRow>
              <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold }}>NOMBRE</BaseTableCell>
              <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold }}>DESCRIPCIÓN</BaseTableCell>
              <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold }}>DESCUENTO</BaseTableCell>
              <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold }}>ESTADO</BaseTableCell>
              <BaseTableCell align="right" sx={{ fontWeight: TYPOGRAPHY.fontWeightBold }}>ACCIONES</BaseTableCell>
            </TableRow>
          </BaseTableHead>
          <BaseTableBody>
            {promociones.length === 0 ? (
              <TableRow>
                <BaseTableCell colSpan={5} align="center" sx={{ py: 4, color: COLORS.textMuted }}>
                  No hay promociones registradas.
                </BaseTableCell>
              </TableRow>
            ) : (
              promociones.map((p) => (
                <TableRow key={p.id} hover sx={{ '&:hover': { backgroundColor: COLORS.surfaceAlt } }}>
                  <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightSemibold, color: COLORS.textPrimary }}>
                    {p.nombre}
                  </BaseTableCell>
                  <BaseTableCell sx={{ color: COLORS.textSecondary }}>{p.descripcion}</BaseTableCell>
                  <BaseTableCell sx={{ fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary }}>
                    {p.descuento}
                  </BaseTableCell>
                  <BaseTableCell>
                    <Chip
                      size="small"
                      label={p.activo ? 'Activo' : 'Inactivo'}
                      sx={{
                        backgroundColor: p.activo ? COLORS.successBg : COLORS.errorBg,
                        color: p.activo ? COLORS.success : COLORS.error,
                        fontWeight: TYPOGRAPHY.fontWeightBold,
                        fontSize: TYPOGRAPHY.caption,
                        borderRadius: `${BORDER.radiusSm}px`,
                        height: 24,
                        '& .MuiChip-label': {
                          px: 1.2,
                        },
                      }}
                    />
                  </BaseTableCell>
                  <BaseTableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <BaseButton
                        className="variant-outlined size-sm"
                        onClick={() => handleEdit(p)}
                      >
                        Editar
                      </BaseButton>
                      <BaseButton
                        className="variant-danger size-sm"
                        onClick={() => handleConfirmDelete(p)}
                      >
                        Eliminar
                      </BaseButton>
                    </Box>
                  </BaseTableCell>
                </TableRow>
              ))
            )}
          </BaseTableBody>
        </BaseTable>
      </BaseTableContainer>

      {/* Diálogo para Crear / Editar Promoción (Usando BaseDialog) */}
      <BaseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <BaseDialogTitle>
          <Typography variant="h6" sx={{ fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textPrimary }}>
            {editing ? 'Editar Promoción' : 'Nueva Promoción'}
          </Typography>
        </BaseDialogTitle>
        <BaseDialogContent dividers sx={{ borderColor: COLORS.border }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" sx={{ fontWeight: TYPOGRAPHY.fontWeightSemibold, color: COLORS.textSecondary }}>
                Nombre de la Promoción
              </Typography>
              <Input
                placeholder="Ej. Café Americano 2x1"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" sx={{ fontWeight: TYPOGRAPHY.fontWeightSemibold, color: COLORS.textSecondary }}>
                Descripción y Horario
              </Typography>
              <Input
                placeholder="Ej. Lunes y martes de 7:00 a 10:00"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" sx={{ fontWeight: TYPOGRAPHY.fontWeightSemibold, color: COLORS.textSecondary }}>
                Descuento
              </Typography>
              <Input
                placeholder="Ej. 50%"
                value={form.descuento}
                onChange={(e) => setForm({ ...form, descuento: e.target.value })}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <input
                type="checkbox"
                id="activo-check"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: COLORS.primary }}
              />
              <label htmlFor="activo-check" style={{ cursor: 'pointer', userSelect: 'none' }}>
                <Typography variant="body2" sx={{ fontWeight: TYPOGRAPHY.fontWeightSemibold, color: COLORS.textPrimary }}>
                  Promoción activa actualmente
                </Typography>
              </label>
            </Box>
          </Box>
        </BaseDialogContent>
        <BaseDialogActions>
          <BaseButton className="variant-outlined" onClick={() => setDialogOpen(false)}>
            Cancelar
          </BaseButton>
          <BaseButton className="variant-primary" onClick={handleSave}>
            Guardar Promoción
          </BaseButton>
        </BaseDialogActions>
      </BaseDialog>

      {/* Pop-up de Confirmación de Eliminación (Usando BaseDialog) */}
      <BaseDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <BaseDialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              bgcolor: COLORS.errorBg,
              color: COLORS.error,
              mb: 2,
            }}
          >
            <DeleteOutlined sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: TYPOGRAPHY.fontWeightExtraBold, color: COLORS.textPrimary }} gutterBottom>
            ¿Eliminar Promoción?
          </Typography>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary, px: 1 }}>
            ¿Está seguro de que desea eliminar la promoción <strong>"{promocionAEliminar?.nombre}"</strong>? Esta acción no se puede deshacer.
          </Typography>
        </BaseDialogContent>
        <BaseDialogActions sx={{ justifyContent: 'center', pb: 2.5, px: 2, gap: 1.5 }}>
          <BaseButton
            className="variant-outlined"
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ flex: 1 }}
          >
            Cancelar
          </BaseButton>
          <BaseButton
            className="variant-danger"
            onClick={handleDeleteExecute}
            sx={{ flex: 1 }}
          >
            Eliminar
          </BaseButton>
        </BaseDialogActions>
      </BaseDialog>

    </Box>
  );
}
