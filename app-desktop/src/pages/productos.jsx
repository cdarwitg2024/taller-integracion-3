import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogContent,
  Stack,
} from '@mui/material';

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

const initialProductos = [
  { id: 1, nombre: 'Café en grano', categoria: 'CAFÉ', stock: 18, minimo: 24, unidad: 'kg', catColor: '#8D6E63', catBg: '#EFEBE9' },
  { id: 2, nombre: 'Leche entera', categoria: 'LÁCTEO', stock: 5, minimo: 12, unidad: 'L', catColor: '#5C6BC0', catBg: '#E8EAF6' },
  { id: 3, nombre: 'Chocolate', categoria: 'INSUMOS', stock: 15, minimo: 8, unidad: 'kg', catColor: '#7E57C2', catBg: '#EDE7F6' },
  { id: 4, nombre: 'Croissant', categoria: 'PANADERÍA', stock: 24, minimo: 10, unidad: 'un', catColor: '#8D6E63', catBg: '#EFEBE9' },
  { id: 5, nombre: 'Medialuna', categoria: 'REPOSTERÍA', stock: 11, minimo: 15, unidad: 'un', catColor: '#D84315', catBg: '#FBE9E7' },
  { id: 6, nombre: 'Té Chai', categoria: 'TÉ', stock: 22, minimo: 10, unidad: 'un', catColor: '#2E7D32', catBg: '#E8F5E9' },
  { id: 7, nombre: 'Vaso 12 oz', categoria: 'DESECHABLES', stock: 150, minimo: 100, unidad: 'un', catColor: '#6A1B9A', catBg: '#F3E5F5' },
  { id: 8, nombre: 'Azúcar', categoria: 'INSUMOS', stock: 20, minimo: 10, unidad: 'kg', catColor: '#7E57C2', catBg: '#EDE7F6' },
];

function CatalogoProductos() {
  const [productos, setProductos] = useState(initialProductos);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formulario de edición
  const [editForm, setEditForm] = useState({
    nombre: '',
    categoria: '',
    stock: 0,
    minimo: 0,
    unidad: '',
  });

  const handleOpenEdit = (prod) => {
    setSelectedProducto(prod);
    setEditForm({
      nombre: prod.nombre,
      categoria: prod.categoria,
      stock: prod.stock,
      minimo: prod.minimo,
      unidad: prod.unidad,
    });
    setDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setDialogOpen(false);
    setSelectedProducto(null);
  };

  const handleSaveEdit = () => {
    if (!selectedProducto) return;
    setProductos((prev) =>
      prev.map((p) =>
        p.id === selectedProducto.id
          ? {
              ...p,
              nombre: editForm.nombre,
              categoria: editForm.categoria,
              stock: Number(editForm.stock),
              minimo: Number(editForm.minimo),
              unidad: editForm.unidad,
            }
          : p
      )
    );
    handleCloseEdit();
  };

  const handleDelete = (id) => {
    setProductos((prev) => prev.filter((p) => p.id !== id));
  };

  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Título de la página */}
      <Typography
        variant="h5"
        fontWeight={800}
        sx={{ color: '#4A3728', mb: 3, letterSpacing: '-0.5px' }}
      >
        Catálogo de Productos
      </Typography>

      {/* Tarjeta contenedora principal estilo imagen */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          borderRadius: '16px',
          border: '1px solid #EFEAE6',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        }}
      >
        {/* Barra de búsqueda */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ color: '#4A3728', mb: 1 }}
          >
            Buscar Producto
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ maxWidth: 500 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Ingrese el nombre del Producto para buscarlo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '24px',
                  backgroundColor: '#F8F6F4',
                  fontSize: '0.85rem',
                  '& fieldset': {
                    borderColor: '#E8E1DA',
                  },
                  '&:hover fieldset': {
                    borderColor: '#C8B2A1',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#4A3728',
                  },
                },
              }}
            />

            <Button
              variant="contained"
              sx={{
                backgroundColor: '#7A5E4E',
                color: '#FFFFFF',
                borderRadius: '24px',
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#5A4335',
                  boxShadow: 'none',
                },
              }}
            >
              Buscar
            </Button>
          </Stack>
        </Box>

        {/* Tabla de Productos */}
        <TableContainer sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F2E9E0' }}>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  PRODUCTO
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  CATEGORÍA
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  STOCK
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  MÍNIMO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  UNIDAD
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  ESTADO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  ACCIONES
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.map((prod) => {
                const isBajo = prod.stock <= prod.minimo;
                return (
                  <TableRow
                    key={prod.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td, &:last-child th': { border: 0 },
                      borderColor: '#F2ECE6',
                    }}
                    onClick={() => handleOpenEdit(prod)}
                  >
                    <TableCell sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                      {prod.nombre}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={prod.categoria}
                        size="small"
                        sx={{
                          backgroundColor: prod.catBg,
                          color: prod.catColor,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          borderRadius: '6px',
                        }}
                      />
                    </TableCell>

                    <TableCell align="center" sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                      {prod.stock}
                    </TableCell>

                    <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                      {prod.minimo}
                    </TableCell>

                    <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                      {prod.unidad}
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={isBajo ? 'STOCK BAJO' : 'NORMAL'}
                        size="small"
                        sx={{
                          backgroundColor: isBajo ? '#FFEBEE' : '#E8F5E9',
                          color: isBajo ? '#C62828' : '#2E7D32',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          borderRadius: '6px',
                        }}
                      />
                    </TableCell>

                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(prod)}
                          sx={{ color: '#C86237' }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(prod.id)}
                          sx={{ color: '#D32F2F' }}
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal / Dialog "Producto Seleccionado" tal como se ve en la foto 2 */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseEdit}
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 2,
            width: '100%',
            maxWidth: 380,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          },
        }}
      >
        <DialogContent sx={{ pt: 2 }}>
          <Typography
            variant="h6"
            fontWeight={800}
            align="center"
            sx={{ color: '#3E2D22', mb: 1.5 }}
          >
            Producto Seleccionado
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
            <Chip
              label={editForm.nombre || 'Producto'}
              sx={{
                backgroundColor: '#FAF2EA',
                color: '#5C4535',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            />
          </Box>

          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Producto
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#FBF9F7',
                  },
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Categoría
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={editForm.categoria}
                onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#FBF9F7',
                  },
                }}
              />
            </Box>

            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Stock Actual
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    },
                  }}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Stock Mínimo
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={editForm.minimo}
                  onChange={(e) => setEditForm({ ...editForm, minimo: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    },
                  }}
                />
              </Box>
            </Stack>

            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Unidad
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={editForm.unidad}
                onChange={(e) => setEditForm({ ...editForm, unidad: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#FBF9F7',
                  },
                }}
              />
            </Box>

            <Stack direction="row" spacing={2} sx={{ pt: 1.5 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleCloseEdit}
                sx={{
                  borderRadius: '24px',
                  textTransform: 'none',
                  borderColor: '#D0C4B8',
                  color: '#6E5C50',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#9E8B7D',
                    backgroundColor: '#FAF6F2',
                  },
                }}
              >
                Cancelar
              </Button>

              <Button
                variant="contained"
                fullWidth
                onClick={handleSaveEdit}
                sx={{
                  borderRadius: '24px',
                  textTransform: 'none',
                  backgroundColor: '#4A3728',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#38281E',
                    boxShadow: 'none',
                  },
                }}
              >
                Guardar
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default CatalogoProductos;
