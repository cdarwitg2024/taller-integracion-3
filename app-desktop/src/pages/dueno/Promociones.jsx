// ─── Pantalla: Promociones (Panel Dueño) ──────────────────────────────────────
// Gestión de promociones activas de la cafetería.
// Accesible solo para usuarios con rol "dueño".
//
// Flujo:
//   1. app.jsx define la ruta /dueno/promociones y el ítem del menú.
//   2. Sidebar renderiza el ítem "Promociones".
//   3. Al hacer clic, se renderiza este componente dentro de AppLayout.
//   4. AppLayout inyecta automáticamente el header consistente (título/subtítulo).

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Card,
  CardContent,
  Stack,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

import BaseButton from '../../components/ui/BaseButton';
import Input from '../../components/ui/BaseInput';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

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
    <Box sx={{ width: '100%', pb: 4 }}>
      
      {/* Cabecera Superior con Título y Botón de Acción Principal */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{ color: 'text.primary', letterSpacing: '-0.5px' }}
          >
            Gestión de Promociones
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Administra las promociones vigentes de la cafetería y su disponibilidad.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{
              backgroundColor: '#4A3728',
              color: '#FFFFFF',
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5,
              py: 1,
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#38281E',
                boxShadow: '0 4px 12px rgba(74, 55, 40, 0.2)',
              },
            }}
          >
            Agregar Promoción
          </Button>
        </Stack>
      </Box>

      {/* Tarjetas de Resumen (KPIs compactos estilo Inventario) */}
      <Grid container spacing={2.5} sx={{ width: '100%', mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '14px',
              border: '1px solid #EFEAE6',
              bgcolor: '#FFFFFF',
              boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
            }}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Stack direction="row" spacing={1.8} sx={{ alignItems: 'center' }}>
                <Box sx={{ p: 1.2, borderRadius: '10px', bgcolor: '#FAF5F0', color: '#4A3728', display: 'flex' }}>
                  <LocalOfferOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Total Promociones
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary' }}>
                    {total}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '14px',
              border: '1px solid #C8E6C9',
              bgcolor: '#E8F5E9',
              boxShadow: 'none',
            }}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Stack direction="row" spacing={1.8} sx={{ alignItems: 'center' }}>
                <CheckCircleOutlinedIcon sx={{ color: '#2E7D32', fontSize: 36 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#2E7D32', fontWeight: 600 }}>
                    Promociones Activas
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#2E7D32' }}>
                    {activas}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '14px',
              border: '1px solid #FFCDD2',
              bgcolor: '#FFEBEE',
              boxShadow: 'none',
            }}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Stack direction="row" spacing={1.8} sx={{ alignItems: 'center' }}>
                <ErrorOutlinedIcon sx={{ color: '#C62828', fontSize: 36 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>
                    Promociones Inactivas
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#C62828' }}>
                    {inactivas}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla Principal de Promociones */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '16px',
          border: '1px solid #EFEAE6',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        }}
      >
        <TableContainer sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F2E9E0' }}>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>NOMBRE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>DESCRIPCIÓN</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>DESCUENTO</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>ESTADO</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>ACCIONES</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promociones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No hay promociones registradas.
                  </TableCell>
                </TableRow>
              ) : (
                promociones.map((p) => (
                  <TableRow key={p.id} sx={{ '&:hover': { backgroundColor: '#FAF7F5' } }}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 600, color: 'text.primary', py: 1.8 }}>
                      {p.nombre}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', py: 1.8 }}>{p.descripcion}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#C86237', py: 1.8 }}>{p.descuento}</TableCell>
                    <TableCell sx={{ py: 1.8 }}>
                      <span style={{ 
                        color: p.activo ? '#2E7D32' : '#C62828',
                        fontWeight: 700,
                        backgroundColor: p.activo ? '#E8F5E9' : '#FFEBEE',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem'
                      }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.8 }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <BaseButton size="sm" variant="outlined" onClick={() => handleEdit(p)}>
                          Editar
                        </BaseButton>
                        <BaseButton size="sm" color="error" onClick={() => handleConfirmDelete(p)}>
                          Eliminar
                        </BaseButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Diálogo para Crear / Editar Promoción */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#EFEAE6' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">Nombre de la Promoción</Typography>
              <Input
                label="Nombre"
                placeholder="Ej. Café Americano 2x1"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">Descripción y Horario</Typography>
              <Input
                label="Descripción"
                placeholder="Ej. Lunes y martes de 7:00 a 10:00"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">Descuento</Typography>
              <Input
                label="Descuento"
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
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="activo-check" style={{ cursor: 'pointer', userSelect: 'none' }}>
                <Typography variant="body2" fontWeight={600}>Promoción activa actualmente</Typography>
              </label>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <BaseButton onClick={() => setDialogOpen(false)} variant="text">Cancelar</BaseButton>
          <BaseButton variant="contained" color="primary" onClick={handleSave}>
            Guardar Promoción
          </BaseButton>
        </DialogActions>
      </Dialog>

      {/* Pop-up de Confirmación de Eliminación (Estilo Moderno igual a Productos) */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        maxWidth="xs" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
      >
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'rgba(211, 47, 47, 0.08)', color: '#D32F2F', mb: 2 }}>
            <DeleteOutlined sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h6" fontWeight={800} gutterBottom sx={{ color: 'text.primary' }}>
            ¿Eliminar Promoción?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            ¿Está seguro de que desea eliminar la promoción <strong>"{promocionAEliminar?.nombre}"</strong>? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2.5, px: 2, gap: 1.5 }}>
          <BaseButton 
            variant="outlined" 
            onClick={() => setDeleteDialogOpen(false)} 
            sx={{ flex: 1, borderRadius: '10px' }}
          >
            Cancelar
          </BaseButton>
          <BaseButton 
            variant="contained" 
            color="error" 
            onClick={handleDeleteExecute} 
            sx={{ flex: 1, borderRadius: '10px', backgroundColor: '#D32F2F', '&:hover': { backgroundColor: '#C62828' } }}
          >
            Eliminar
          </BaseButton>
        </DialogActions>
      </Dialog>

    </Box>
  );
}