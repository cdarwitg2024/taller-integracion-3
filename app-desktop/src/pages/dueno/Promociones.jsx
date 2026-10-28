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
  Button,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { colors, spacing, typography } from '../theme';

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
    <Box sx={{ padding: spacing.lg }}>
      {/* Cabecera de la sección */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.lg }}>
        <Box>
          <Typography variant="h5" fontWeight={typography.pesoBold} color={colors.cafeOscuro}>
            Promociones
          </Typography>
          <Typography variant="cuerpoPequeno" color={colors.textoSecundario}>
            Administra las promociones activas de la cafetería.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="sm"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Agregar Promoción
        </Button>
      </Box>

      {/* Tarjeta con lista de promociones */}
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
                    <TableCell component="th" scope="row">
                      {p.nombre}
                    </TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell>{p.descuento}</TableCell>
                    <TableCell>
                      <span style={{ color: p.activo ? colors.verde : colors.rojo }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleEdit(p)}>
                        Editar
                      </Button>
                      <Button size="sm" onClick={() => handleDelete(p.id)}>
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </TableContainer>
        </Card>

        {/* Diálogo para crear/editar promoción */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
          <DialogTitle>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
          <DialogContent>
            <Input
              label="Nombre"
              placeholder="Ej. Café Americano 2x1"
              value={form.nombre}
              onChangeText={(t) => setForm({ ...form, nombre: t })}
            />
            <Input
              label="Descripción"
              placeholder="Ej. Lunes y martes de 7:00 a 10:00"
              value={form.descripcion}
              onChangeText={(t) => setForm({ ...form, descripcion: t })}
            />
            <Input
              label="Descuento"
              placeholder="Ej. 50%"
              value={form.descuento}
              onChangeText={(t) => setForm({ ...form, descuento: t })}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mt: spacing.sm }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <Typography variant="cuerpoPequeno">Activo</Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" color="primary" onClick={handleSave}>
              Guardar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
