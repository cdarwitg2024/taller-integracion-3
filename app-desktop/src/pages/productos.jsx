import { useState, useEffect } from 'react';
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
  LinearProgress,
  Snackbar,
  Alert,
} from '@mui/material';

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import { productos as productosService } from '../service/productos';

function CatalogoProductos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Formulario de edición
  const [editForm, setEditForm] = useState({
    nombre: '',
    categoria: '',
    stock: 0,
    minimo: 0,
    unidad: '',
  });

  const loadProductos = async () => {
    setLoading(true);
    try {
      const data = await productosService.getAll();
      setProductos(data);
    } catch (err) {
      console.error('Error al cargar productos desde la base de datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductos();
  }, []);

  const handleOpenEdit = (prod) => {
    setSelectedProducto(prod);
    setFormError('');
    setEditForm({
      nombre: prod.nombre,
      categoria: prod.categoria,
      stock: prod.stock,
      minimo: prod.minimo ?? prod.stock_minimo ?? 0,
      unidad: prod.unidad || 'un',
    });
    setDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setDialogOpen(false);
    setSelectedProducto(null);
    setFormError('');
  };

  const handleSaveEdit = async () => {
    if (!selectedProducto) return;
    setFormError('');

    // Validación según NFR-04 y Diagrama de Secuencia (Dueño)
    if (!editForm.nombre || !editForm.nombre.trim()) {
      setFormError('Errores de validación: El nombre del producto es obligatorio.');
      return;
    }
    if (Number(editForm.stock) < 0 || Number(editForm.minimo) < 0) {
      setFormError('Errores de validación: El stock y stock mínimo deben ser valores positivos o cero.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: editForm.nombre.trim(),
        categoria: editForm.categoria.trim(),
        stock: Number(editForm.stock),
        stock_minimo: Number(editForm.minimo),
        minimo: Number(editForm.minimo),
        unidad: editForm.unidad.trim() || 'un',
      };

      const updated = await productosService.update(selectedProducto.id, payload);
      setProductos((prev) =>
        prev.map((p) => (p.id === selectedProducto.id ? { ...p, ...updated } : p))
      );
      setSnackbar({ open: true, message: 'Producto guardado exitosamente.', severity: 'success' });
      handleCloseEdit();
    } catch (err) {
      console.error('Error al guardar edición en la base de datos:', err);
      setFormError('Error al guardar en el servidor. Intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await productosService.delete(id);
      setProductos((prev) => prev.filter((p) => p.id !== id));
      setSnackbar({ open: true, message: 'Producto desactivado/eliminado correctamente.', severity: 'info' });
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      setSnackbar({ open: true, message: 'Error al eliminar el producto.', severity: 'error' });
    }
  };

  const filtered = productos.filter((p) =>
    (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Título de la página y acción de refrescar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
        >
          Catálogo de Productos
        </Typography>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadProductos}
          disabled={loading}
          sx={{
            borderColor: '#C8B2A1',
            color: '#4A3728',
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              borderColor: '#4A3728',
              backgroundColor: '#FAF7F4',
            },
          }}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </Box>

      {/* Tarjeta contenedora principal */}
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

        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2, bgcolor: '#FAF2EA', '& .MuiLinearProgress-bar': { bgcolor: '#C86237' } }} />}

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
              {filtered.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    {searchTerm
                      ? `No se encontraron productos que coincidan con "${searchTerm}".`
                      : 'No se encontraron productos registrados.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((prod) => {
                  const minVal = prod.minimo ?? prod.stock_minimo ?? 0;
                  const isBajo = prod.stock <= minVal;
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
                          label={prod.categoria || 'GENERAL'}
                          size="small"
                          sx={{
                            backgroundColor: prod.catBg || '#EFEBE9',
                            color: prod.catColor || '#8D6E63',
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
                        {minVal}
                      </TableCell>

                      <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                        {prod.unidad || 'un'}
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
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal / Dialog "Producto Seleccionado" */}
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

            {formError && (
              <Alert severity="error" sx={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                {formError}
              </Alert>
            )}

            <Stack direction="row" spacing={2} sx={{ pt: 1.5 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={saving}
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
                disabled={saving}
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
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Notificaciones visuales de éxito / error (NFR-04 y Diagrama de Secuencia) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CatalogoProductos;
