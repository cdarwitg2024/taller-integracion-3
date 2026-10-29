// ─── Pantalla: Promociones (Panel Dueño) ──────────────────────────────────────
// Gestión de promociones activas de la cafetería.
// Accesible solo para usuarios con rol "dueño".

import React, { useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

import BaseButton from '../../components/ui/BaseButton';
import Input from '../../components/ui/BaseInput';
import Card from '../../components/ui/BaseCard';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

const initialPromociones = [
  { id: 1, nombre: 'Café Americano 2x1', descripcion: 'Lunes y martes de 7:00 a 10:00', descuento: '50%', activo: true },
  { id: 2, nombre: 'Combo Desayuno', descripcion: 'Café + medialuna + jugo', descuento: '20%', activo: true },
  { id: 3, nombre: 'Tarde de Té', descripcion: 'Té + pastelería desde las 16:00', descuento: '30%', activo: false },
];

export default function Promociones({ currentUser }) {
  const [promociones, setPromociones] = useState(initialPromociones);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de eliminar esta promoción?')) {
      setPromociones(promociones.filter((p) => p.id !== id));
    }
  };

  const handleSave = () => {
    if (!form.nombre || !form.descuento) return;
    if (editing) {
      setPromociones(promociones.map((p) => (p.id === form.id ? { ...p, ...form } : p)));
    } else {
      const newId = Math.max(...promociones.map((p) => p.id), 0) + 1;
      setPromociones([...promociones, { ...form, id: newId }]);
    }
    setDialogOpen(false);
  };

  return (
    <Box sx={{ padding: SPACING.lg }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: SPACING.lg }}>
        <BaseButton variant="contained" size="sm" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Agregar Promoción
        </BaseButton>
      </Box>

      <Box sx={{ display: 'flex', gap: SPACING.md, mb: SPACING.lg, flexWrap: 'wrap' }}>
        <Card variant="outlined" padding="md" sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="body2" color={COLORS.textSecondary}>Total</Typography>
          <Typography variant="h4" fontWeight={TYPOGRAPHY.fontWeightBold} color={COLORS.primary}>{total}</Typography>
        </Card>
        <Card variant="outlined" padding="md" sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="body2" color={COLORS.textSecondary}>Activas</Typography>
          <Typography variant="h4" fontWeight={TYPOGRAPHY.fontWeightBold} color={COLORS.success}>{activas}</Typography>
        </Card>
        <Card variant="outlined" padding="md" sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="body2" color={COLORS.textSecondary}>Inactivas</Typography>
          <Typography variant="h4" fontWeight={TYPOGRAPHY.fontWeightBold} color={COLORS.error}>{inactivas}</Typography>
        </Card>
      </Box>

      <Card variant="outlined" padding="lg">
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Descuento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promociones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay promociones registradas.
                  </TableCell>
                </TableRow>
              ) : (
                promociones.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell component="th" scope="row">{p.nombre}</TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell>{p.descuento}</TableCell>
                    <TableCell>
                      <span style={{ color: p.activo ? COLORS.success : COLORS.error }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <BaseButton size="sm" onClick={() => handleEdit(p)}>Editar</BaseButton>
                      <BaseButton size="sm" onClick={() => handleDelete(p.id)}>Eliminar</BaseButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogTitle>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, mt: SPACING.sm }}>
            <Input label="Nombre" placeholder="Ej. Café Americano 2x1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <Input label="Descripción" placeholder="Ej. Lunes y martes de 7:00 a 10:00" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <Input label="Descuento" placeholder="Ej. 50%" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <Typography variant="body2">Activo</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <BaseButton onClick={() => setDialogOpen(false)}>Cancelar</BaseButton>
          <BaseButton variant="contained" color="primary" onClick={handleSave}>Guardar</BaseButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
