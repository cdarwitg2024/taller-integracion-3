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
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  InputAdornment,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import { productos as productosService } from '../service/productos';
import { cafeterias as cafeteriasService } from '../service/cafeterias';
import { categorias as categoriasService } from '../service/categorias';

function CatalogoProductos() {
  const [productos, setProductos] = useState([]);
  const [cafeteriasList, setCafeteriasList] = useState([]);
  const [categoriasList, setCategoriasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Diálogo y formulario de edición (FR-44)
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editForm, setEditForm] = useState({
    nombre: '',
    categoria: '',
    categoria_id: '',
    cafeteria_id: '',
    precio: '',
    stock: 0,
    minimo: 0,
    unidad: '',
    activo: true,
  });

  // Diálogo y formulario de creación (FR-43)
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState('');
  const initialCreateForm = {
    nombre: '',
    precio: '',
    stock: 0,
    stock_minimo: 5,
    activo: true,
    cafeteria_id: '',
    categoria_id: '',
    unidad: 'un',
    descripcion: '',
  };
  const [createForm, setCreateForm] = useState(initialCreateForm);

  // Diálogo de confirmación de eliminación (FR-45)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productoToDelete, setProductoToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar para notificaciones
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadProductos = async () => {
    setLoading(true);
    try {
      const data = await productosService.getAll();
      setProductos(data);
    } catch (err) {
      console.error('Error al cargar productos desde la base de datos:', err);
      setSnackbar({
        open: true,
        message: 'Error al cargar productos de la base de datos.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCafeterias = async () => {
    try {
      const data = await cafeteriasService.getAll();
      setCafeteriasList(data || []);
      if (data && data.length > 0) {
        setCreateForm((prev) => ({
          ...prev,
          cafeteria_id: prev.cafeteria_id || data[0].id,
        }));
      }
    } catch (err) {
      console.error('Error al cargar cafeterías:', err);
    }
  };

  const loadCategorias = async () => {
    try {
      const data = await categoriasService.getAll();
      setCategoriasList(data || []);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    }
  };

  useEffect(() => {
    loadProductos();
    loadCafeterias();
    loadCategorias();
  }, []);

  // --- Apertura y manejo de Creación (FR-43) ---
  const handleOpenCreate = () => {
    setCreateFormError('');
    setCreateForm({
      ...initialCreateForm,
      cafeteria_id: cafeteriasList.length > 0 ? cafeteriasList[0].id : '',
    });
    setCreateDialogOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setCreateFormError('');
  };

  const handleSaveCreate = async () => {
    setCreateFormError('');

    // Validación de campos
    if (!createForm.nombre || !createForm.nombre.trim()) {
      setCreateFormError('El nombre del producto es obligatorio.');
      return;
    }

    if (!createForm.precio || isNaN(Number(createForm.precio)) || Number(createForm.precio) <= 0) {
      setCreateFormError('El precio debe ser un número mayor a 0.');
      return;
    }

    if (createForm.stock === '' || isNaN(Number(createForm.stock)) || Number(createForm.stock) < 0) {
      setCreateFormError('El stock inicial debe ser un número mayor o igual a 0.');
      return;
    }

    if (
      createForm.stock_minimo !== '' &&
      (isNaN(Number(createForm.stock_minimo)) || Number(createForm.stock_minimo) < 0)
    ) {
      setCreateFormError('El stock mínimo debe ser un número mayor o igual a 0.');
      return;
    }

    if (!createForm.cafeteria_id) {
      setCreateFormError('Debe seleccionar una cafetería asociada.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: createForm.nombre.trim(),
        precio: Number(createForm.precio),
        stock: Number(createForm.stock),
        stock_minimo: Number(createForm.stock_minimo || 0),
        activo: Boolean(createForm.activo),
        cafeteria_id: Number(createForm.cafeteria_id),
        categoria_id: createForm.categoria_id ? Number(createForm.categoria_id) : null,
        unidad: createForm.unidad?.trim() || 'un',
        descripcion: createForm.descripcion?.trim() || '',
      };

      const nuevoProducto = await productosService.create(payload);

      // Actualizar listado
      setProductos((prev) => [nuevoProducto, ...prev.filter((p) => p.id !== nuevoProducto.id)]);
      setSnackbar({
        open: true,
        message: 'Producto creado exitosamente.',
        severity: 'success',
      });
      handleCloseCreate();
    } catch (err) {
      console.error('Error al crear producto en Supabase:', err);
      setCreateFormError(err.message || 'Error al guardar el producto en el servidor.');
    } finally {
      setSaving(false);
    }
  };

  // --- Apertura y manejo de Edición (FR-44) ---
  const handleOpenEdit = (prod) => {
    setSelectedProducto(prod);
    setFormError('');
    setEditForm({
      nombre: prod.nombre || '',
      categoria: prod.categoria || '',
      categoria_id: prod.categoria_id || '',
      cafeteria_id: prod.cafeteria_id || (cafeteriasList.length > 0 ? cafeteriasList[0].id : ''),
      precio: prod.precio ?? '',
      stock: prod.stock ?? 0,
      minimo: prod.minimo ?? prod.stock_minimo ?? 0,
      unidad: prod.unidad || 'un',
      activo: prod.activo !== undefined ? prod.activo : true,
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

    // Validación según NFR-04 y FR-44
    if (!editForm.nombre || !editForm.nombre.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }
    if (editForm.precio === '' || isNaN(Number(editForm.precio)) || Number(editForm.precio) <= 0) {
      setFormError('El precio debe ser un número válido mayor a 0.');
      return;
    }
    if (editForm.stock === '' || isNaN(Number(editForm.stock)) || Number(editForm.stock) < 0) {
      setFormError('El stock no puede ser un valor negativo.');
      return;
    }
    if (editForm.minimo !== '' && (isNaN(Number(editForm.minimo)) || Number(editForm.minimo) < 0)) {
      setFormError('El stock mínimo no puede ser un valor negativo.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: editForm.nombre.trim(),
        precio: Number(editForm.precio),
        stock: Number(editForm.stock),
        stock_minimo: Number(editForm.minimo),
        minimo: Number(editForm.minimo),
        unidad: editForm.unidad?.trim() || 'un',
        activo: Boolean(editForm.activo),
        cafeteria_id: editForm.cafeteria_id ? Number(editForm.cafeteria_id) : selectedProducto.cafeteria_id,
        categoria_id: editForm.categoria_id ? Number(editForm.categoria_id) : selectedProducto.categoria_id,
      };

      const updated = await productosService.update(selectedProducto.id, payload);

      // Actualizar la lista tras editar (FR-44)
      setProductos((prev) =>
        prev.map((p) => (p.id === selectedProducto.id ? { ...p, ...updated } : p))
      );
      setSnackbar({ open: true, message: 'Producto actualizado exitosamente.', severity: 'success' });
      handleCloseEdit();
    } catch (err) {
      console.error('Error al guardar edición en la base de datos:', err);
      setFormError(err.message || 'Error al guardar en el servidor. Intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // --- Apertura y manejo de Eliminación con Confirmación (FR-45) ---
  const handleOpenDelete = (prod) => {
    setProductoToDelete(prod);
    setDeleteDialogOpen(true);
  };

  const handleCloseDelete = () => {
    setDeleteDialogOpen(false);
    setProductoToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!productoToDelete) return;
    setDeleting(true);
    try {
      // Eliminar producto en Supabase (FR-45)
      await productosService.delete(productoToDelete.id);

      // Actualizar la lista tras eliminar
      setProductos((prev) => prev.filter((p) => p.id !== productoToDelete.id));
      setSnackbar({
        open: true,
        message: `Producto "${productoToDelete.nombre}" eliminado exitosamente.`,
        severity: 'success',
      });
      handleCloseDelete();
    } catch (err) {
      console.error('Error al eliminar producto en Supabase:', err);
      setSnackbar({
        open: true,
        message: err.message || 'Error al eliminar el producto del servidor.',
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = productos.filter((p) =>
    (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Título de la página y botones de acción */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
        >
          Catálogo de Productos
        </Typography>

        <Stack direction="row" spacing={1.5}>
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

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              backgroundColor: '#C86237',
              color: '#FFFFFF',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#A04E2B',
                boxShadow: 'none',
              },
            }}
          >
            Nuevo Producto
          </Button>
        </Stack>
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

        {loading && (
          <LinearProgress
            sx={{
              mb: 2,
              borderRadius: 2,
              bgcolor: '#FAF2EA',
              '& .MuiLinearProgress-bar': { bgcolor: '#C86237' },
            }}
          />
        )}

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
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  CAFETERÍA
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  PRECIO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  STOCK
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  MÍNIMO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  DISPONIBILIDAD
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  ACCIONES
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    {searchTerm
                      ? `No se encontraron productos que coincidan con "${searchTerm}".`
                      : 'No se encontraron productos registrados.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((prod) => {
                  const minVal = prod.minimo ?? prod.stock_minimo ?? 0;
                  const stockNum = Number(prod.stock || 0);
                  const isSinStock = stockNum <= 0;
                  const isBajo = stockNum > 0 && stockNum <= minVal;
                  return (
                    <TableRow
                      key={prod.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderColor: '#F2ECE6',
                        backgroundColor: isSinStock ? 'rgba(255, 205, 210, 0.25)' : 'inherit',
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

                      <TableCell sx={{ color: '#5C4535', fontSize: '0.82rem' }}>
                        {prod.cafeteria_nombre || prod.cafeterias?.nombre || 'Cafetería Central'}
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 700, color: '#3E2D22', fontSize: '0.85rem' }}>
                        ${Number(prod.precio || 0).toLocaleString('es-CL')}
                      </TableCell>

                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 700,
                          color: isSinStock ? '#B71C1C' : isBajo ? '#E65100' : '#3E2D22',
                          fontSize: '0.85rem',
                        }}
                      >
                        {prod.stock}
                      </TableCell>

                      <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                        {minVal}
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={
                            !prod.activo
                              ? 'NO DISPONIBLE'
                              : isSinStock
                              ? 'SIN STOCK'
                              : isBajo
                              ? 'STOCK BAJO'
                              : 'DISPONIBLE'
                          }
                          size="small"
                          sx={{
                            backgroundColor:
                              !prod.activo
                                ? '#EEEEEE'
                                : isSinStock
                                ? '#FFCDD2'
                                : isBajo
                                ? '#FFF3E0'
                                : '#E8F5E9',
                            color:
                              !prod.activo
                                ? '#757575'
                                : isSinStock
                                ? '#B71C1C'
                                : isBajo
                                ? '#E65100'
                                : '#2E7D32',
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            borderRadius: '6px',
                            border: isSinStock ? '1px solid #EF9A9A' : 'none',
                          }}
                        />
                      </TableCell>

                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEdit(prod)}
                            sx={{ color: '#C86237' }}
                            title="Editar Producto"
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDelete(prod)}
                            sx={{ color: '#D32F2F' }}
                            title="Eliminar Producto"
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

      {/* ======================================================== */}
      {/* FORMULARIO DE CREACIÓN DE PRODUCTO (FR-43)                */}
      {/* ======================================================== */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreate}
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 2,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          },
        }}
      >
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography
            variant="h6"
            fontWeight={800}
            align="center"
            sx={{ color: '#3E2D22', mb: 2.5 }}
          >
            Crear Nuevo Producto
          </Typography>

          {createFormError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.82rem' }}>
              {createFormError}
            </Alert>
          )}

          <Stack spacing={2}>
            {/* Nombre */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Nombre del Producto *
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Ej. Café Espresso Doble, Croissant de Almendras"
                value={createForm.nombre}
                onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#FBF9F7',
                  },
                }}
              />
            </Box>

            {/* Cafetería Asociada y Categoría */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Cafetería Asociada *
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={createForm.cafeteria_id}
                    onChange={(e) => setCreateForm({ ...createForm, cafeteria_id: e.target.value })}
                    displayEmpty
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    }}
                  >
                    <MenuItem value="" disabled>
                      Seleccione Cafetería
                    </MenuItem>
                    {cafeteriasList.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Categoría
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={createForm.categoria_id}
                    onChange={(e) => setCreateForm({ ...createForm, categoria_id: e.target.value })}
                    displayEmpty
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    }}
                  >
                    <MenuItem value="">Sin Categoría</MenuItem>
                    {categoriasList.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>

            {/* Precio y Unidad */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Precio ($ CLP) *
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  placeholder="Ej. 2500"
                  value={createForm.precio}
                  onChange={(e) => setCreateForm({ ...createForm, precio: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
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
                  Unidad de Medida
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="un, kg, L"
                  value={createForm.unidad}
                  onChange={(e) => setCreateForm({ ...createForm, unidad: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    },
                  }}
                />
              </Box>
            </Stack>

            {/* Stock y Stock Mínimo */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Stock Inicial *
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={createForm.stock}
                  onChange={(e) => setCreateForm({ ...createForm, stock: e.target.value })}
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
                  Stock Mínimo Alerta
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={createForm.stock_minimo}
                  onChange={(e) => setCreateForm({ ...createForm, stock_minimo: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    },
                  }}
                />
              </Box>
            </Stack>

            {/* Disponibilidad (Activo) */}
            <Box sx={{ bgcolor: '#FAF7F4', p: 1.5, borderRadius: '12px', border: '1px solid #EFEAE6' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.activo}
                    onChange={(e) => setCreateForm({ ...createForm, activo: e.target.checked })}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#4A3728' }}>
                      {createForm.activo ? 'Disponible para la Venta' : 'No disponible (Inactivo)'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
                      {createForm.activo ? 'El producto será visible para clientes y pedidos' : 'El producto permanecerá oculto'}
                    </Typography>
                  </Box>
                }
              />
            </Box>

            {/* Descripción */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Descripción (opcional)
              </Typography>
              <TextField
                size="small"
                fullWidth
                multiline
                rows={2}
                placeholder="Breve detalle de la preparación o características del producto..."
                value={createForm.descripcion}
                onChange={(e) => setCreateForm({ ...createForm, descripcion: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#FBF9F7',
                  },
                }}
              />
            </Box>

            {/* Botones de acción */}
            <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={saving}
                onClick={handleCloseCreate}
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
                onClick={handleSaveCreate}
                sx={{
                  borderRadius: '24px',
                  textTransform: 'none',
                  backgroundColor: '#C86237',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#A04E2B',
                    boxShadow: 'none',
                  },
                }}
              >
                {saving ? 'Guardando...' : 'Crear Producto'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* FORMULARIO DE EDICIÓN DE PRODUCTO EXISTENTE (FR-44)      */}
      {/* ======================================================== */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseEdit}
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 2,
            width: '100%',
            maxWidth: 480,
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
            Editar Producto
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
            {/* Nombre */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                Nombre del Producto *
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

            {/* Cafetería Asociada y Categoría */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Cafetería
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={editForm.cafeteria_id}
                    onChange={(e) => setEditForm({ ...editForm, cafeteria_id: e.target.value })}
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    }}
                  >
                    {cafeteriasList.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Categoría
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={editForm.categoria_id}
                    onChange={(e) => setEditForm({ ...editForm, categoria_id: e.target.value })}
                    displayEmpty
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FBF9F7',
                    }}
                  >
                    <MenuItem value="">Sin Categoría</MenuItem>
                    {categoriasList.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>

            {/* Precio y Unidad */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Precio ($ CLP) *
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={editForm.precio}
                  onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
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
                  Unidad de Medida
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
            </Stack>

            {/* Stock y Stock Mínimo */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.5 }}>
                  Stock Actual *
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

            {/* Disponibilidad */}
            <Box sx={{ bgcolor: '#FAF7F4', p: 1.5, borderRadius: '12px', border: '1px solid #EFEAE6' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.activo}
                    onChange={(e) => setEditForm({ ...editForm, activo: e.target.checked })}
                    color="success"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#4A3728' }}>
                    {editForm.activo ? 'Disponible para la Venta' : 'No disponible (Inactivo)'}
                  </Typography>
                }
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
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN (FR-45)           */}
      {/* ======================================================== */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDelete}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 2,
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          },
        }}
      >
        <DialogContent sx={{ pt: 1.5, textAlign: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: '#FFEBEE',
              color: '#D32F2F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <DeleteOutlineOutlinedIcon fontSize="large" />
          </Box>

          <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22', mb: 1 }}>
            ¿Eliminar Producto?
          </Typography>

          <Typography variant="body2" sx={{ color: '#78665B', mb: 2 }}>
            ¿Está seguro de que desea eliminar el producto{' '}
            <strong>"{productoToDelete?.nombre}"</strong>? Esta acción lo desactivará del catálogo.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={deleting}
              onClick={handleCloseDelete}
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
              disabled={deleting}
              onClick={handleConfirmDelete}
              sx={{
                borderRadius: '24px',
                textTransform: 'none',
                backgroundColor: '#D32F2F',
                color: '#FFFFFF',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#B71C1C',
                  boxShadow: 'none',
                },
              }}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Notificaciones visuales de éxito / error */}
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
