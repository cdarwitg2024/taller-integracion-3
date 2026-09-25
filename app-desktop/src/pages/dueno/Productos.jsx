import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
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
  Tooltip,
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
  Card,
  CardContent,
  Divider,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import SortIcon from '@mui/icons-material/Sort';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { productos as productosService } from '../../service/productos';
import { cafeterias as cafeteriasService } from '../../service/cafeterias';
import { categorias as categoriasService } from '../../service/categorias';
import ModificarPrecioDialog from '../../components/productos/ModificarPrecioDialog';
import ModificarStockDialog from '../../components/productos/ModificarStockDialog';

function CatalogoProductos() {
  const navigate = useNavigate();

  const [productos, setProductos] = useState([]);
  const [cafeteriasList, setCafeteriasList] = useState([]);
  const [categoriasList, setCategoriasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedCafeteria, setSelectedCafeteria] = useState('todas');
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [sortBy, setSortBy] = useState('nombre_asc');
  
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

  // Operación separada: Diálogo para Modificar Precio (FR-46)
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false);
  const [productoParaPrecio, setProductoParaPrecio] = useState(null);

  // Operación separada: Diálogo para Modificar Stock (FR-47)
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [productoParaStock, setProductoParaStock] = useState(null);

  const handleOpenPrecio = (prod) => {
    setProductoParaPrecio(prod);
    setPrecioDialogOpen(true);
  };

  const handleOpenStock = (prod) => {
    setProductoParaStock(prod);
    setStockDialogOpen(true);
  };

  const handlePrecioSuccess = (updatedProd, message) => {
    setProductos((prev) =>
      prev.map((p) => (p.id === updatedProd.id ? { ...p, ...updatedProd } : p))
    );
    setSnackbar({
      open: true,
      message: message || 'Precio actualizado exitosamente.',
      severity: 'success',
    });
  };

  const handleStockSuccess = (updatedProd, message) => {
    setProductos((prev) =>
      prev.map((p) => (p.id === updatedProd.id ? { ...p, ...updatedProd } : p))
    );
    setSnackbar({
      open: true,
      message: message || 'Stock actualizado exitosamente.',
      severity: 'success',
    });
  };

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

  // Métricas rápidas para filtros y KPI
  const totalCount = productos.length;
  const disponiblesCount = productos.filter((p) => p.activo && Number(p.stock || 0) > 0).length;
  const stockBajoCount = productos.filter((p) => {
    const s = Number(p.stock || 0);
    const m = Number(p.stock_minimo ?? p.minimo ?? 0);
    return s > 0 && s <= m;
  }).length;
  const sinStockCount = productos.filter((p) => Number(p.stock || 0) <= 0).length;
  const optimosCount = productos.filter((p) => {
    const s = Number(p.stock || 0);
    const m = Number(p.stock_minimo ?? p.minimo ?? 0);
    return s > m;
  }).length;
  const inactivosCount = productos.filter((p) => !p.activo).length;

  // Valor total del inventario para KPI financiero
  const valorTotalInventario = useMemo(() => {
    return productos.reduce((acc, p) => {
      const stock = Number(p.stock || 0);
      const precio = Number(p.precio || 0);
      return acc + (stock > 0 && precio > 0 ? stock * precio : 0);
    }, 0);
  }, [productos]);

  const formatPrecio = (num) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(Number(num) || 0);
  };

  // Lista unificada de categorías
  const categoriasUnicas = useMemo(() => {
    const map = new Map();
    categoriasList.forEach((c) => {
      if (c && c.nombre) map.set(String(c.id), c.nombre);
    });
    productos.forEach((p) => {
      if (p.categoria && !map.has(p.categoria)) {
        map.set(p.categoria, p.categoria);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [categoriasList, productos]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    selectedCategoria !== 'todas' ||
    selectedCafeteria !== 'todas' ||
    selectedEstado !== 'todos' ||
    sortBy !== 'nombre_asc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategoria('todas');
    setSelectedCafeteria('todas');
    setSelectedEstado('todos');
    setSortBy('nombre_asc');
  };

  // Filtrado y ordenamiento inteligente avanzado
  const filtered = useMemo(() => {
    const result = productos.filter((p) => {
      // 1. Buscador de texto (nombre, categoría, descripción)
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.categoria || '').toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term);

      // 2. Filtro de Categoría
      const matchCat =
        selectedCategoria === 'todas' ||
        String(p.categoria_id) === String(selectedCategoria) ||
        (p.categoria || '').toLowerCase() === selectedCategoria.toLowerCase();

      // 3. Filtro de Cafetería
      const matchCafeteria =
        selectedCafeteria === 'todas' ||
        String(p.cafeteria_id) === String(selectedCafeteria);

      // 4. Filtro de Estado / Disponibilidad
      const stockNum = Number(p.stock || 0);
      const minVal = Number(p.stock_minimo ?? p.minimo ?? 0);
      const isSinStock = stockNum <= 0;
      const isBajo = stockNum > 0 && stockNum <= minVal;
      const isOptimo = stockNum > minVal;
      const isActivo = Boolean(p.activo);

      let matchEstado = true;
      if (selectedEstado === 'disponibles') {
        matchEstado = isActivo && stockNum > 0;
      } else if (selectedEstado === 'reposicion') {
        matchEstado = isSinStock || isBajo;
      } else if (selectedEstado === 'Sin Stock') {
        matchEstado = isSinStock;
      } else if (selectedEstado === 'Stock Bajo') {
        matchEstado = isBajo;
      } else if (selectedEstado === 'optimo') {
        matchEstado = isOptimo;
      } else if (selectedEstado === 'inactivos') {
        matchEstado = !isActivo;
      }

      return matchSearch && matchCat && matchCafeteria && matchEstado;
    });

    result.sort((a, b) => {
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      const precioA = Number(a.precio || 0);
      const precioB = Number(b.precio || 0);

      if (sortBy === 'precio_desc') return precioB - precioA;
      if (sortBy === 'precio_asc') return precioA - precioB;
      if (sortBy === 'stock_asc') return stockA - stockB;
      if (sortBy === 'stock_desc') return stockB - stockA;
      if (sortBy === 'nombre_asc') {
        return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return (b.nombre || '').localeCompare(a.nombre || '', 'es', { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [productos, searchTerm, selectedCategoria, selectedCafeteria, selectedEstado, sortBy]);

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Título unificado y acciones principales */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1.5 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                backgroundColor: '#FAF2EA',
                color: '#C86237',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorefrontOutlinedIcon />
            </Box>
            <Box>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
              >
                Gestión de Productos y Stock
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                Catálogo general, control de precios, existencias y valorización de inventario
              </Typography>
            </Box>
          </Stack>
        </Box>

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

      {/* 5 Tarjetas KPI con Métricas y Valorización Total */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Productos */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title="Ver todos los productos registrados">
            <Card
              elevation={0}
              onClick={() => setSelectedEstado('todos')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: '1px solid #EFEAE6',
                bgcolor: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(74, 55, 40, 0.08)' },
              }}
            >
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      bgcolor: '#F5EBE1',
                      color: '#6F4E37',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MenuBookOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Total Catálogo
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22' }}>
                      {totalCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Valor Total del Inventario */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '14px',
              border: '1px solid #EFEAE6',
              bgcolor: '#FFFFFF',
            }}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '10px',
                    bgcolor: '#EDE7F6',
                    color: '#5E35B1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AccountBalanceWalletOutlinedIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                    Valor Inventario
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22' }}>
                    {formatPrecio(valorTotalInventario)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sin Stock */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title={selectedEstado === 'Sin Stock' ? 'Quitar filtro' : 'Filtrar productos sin stock'}>
            <Card
              elevation={0}
              onClick={() => setSelectedEstado(selectedEstado === 'Sin Stock' ? 'todos' : 'Sin Stock')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'Sin Stock' ? '2px solid #B71C1C' : sinStockCount > 0 ? '1px solid #FFCDD2' : '1px solid #EFEAE6',
                bgcolor: sinStockCount > 0 ? '#FFEBEE' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedEstado === 'Sin Stock' ? '0 4px 12px rgba(183, 28, 28, 0.2)' : 'none',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      bgcolor: sinStockCount > 0 ? '#FFCDD2' : '#F5F5F5',
                      color: sinStockCount > 0 ? '#B71C1C' : '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ErrorOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Sin Stock (0 unid.)
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ color: sinStockCount > 0 ? '#B71C1C' : '#3E2D22' }}
                    >
                      {sinStockCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Stock Bajo */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title={selectedEstado === 'Stock Bajo' ? 'Quitar filtro' : 'Filtrar stock bajo o crítico'}>
            <Card
              elevation={0}
              onClick={() => setSelectedEstado(selectedEstado === 'Stock Bajo' ? 'todos' : 'Stock Bajo')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'Stock Bajo' ? '2px solid #E65100' : stockBajoCount > 0 ? '1px solid #FFE0B2' : '1px solid #EFEAE6',
                bgcolor: stockBajoCount > 0 ? '#FFF3E0' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedEstado === 'Stock Bajo' ? '0 4px 12px rgba(230, 81, 0, 0.2)' : 'none',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      bgcolor: stockBajoCount > 0 ? '#FFE0B2' : '#F5F5F5',
                      color: stockBajoCount > 0 ? '#E65100' : '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <WarningAmberIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Stock Bajo (≤ Mínimo)
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ color: stockBajoCount > 0 ? '#E65100' : '#3E2D22' }}
                    >
                      {stockBajoCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Stock Óptimo */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title={selectedEstado === 'optimo' ? 'Quitar filtro' : 'Filtrar productos con stock óptimo'}>
            <Card
              elevation={0}
              onClick={() => setSelectedEstado(selectedEstado === 'optimo' ? 'todos' : 'optimo')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'optimo' ? '2px solid #2E7D32' : '1px solid #EFEAE6',
                bgcolor: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedEstado === 'optimo' ? '0 4px 12px rgba(46, 125, 50, 0.2)' : 'none',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      bgcolor: '#E8F5E9',
                      color: '#2E7D32',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircleOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Stock Óptimo
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#2E7D32' }}>
                      {optimosCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>
      </Grid>

      {/* Tarjeta contenedora principal con Filtros y Tabla */}
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
        {/* ======================================================== */}
        {/* PANEL DE BÚSQUEDA Y FILTROS AVANZADOS (SIN EMOJIS)        */}
        {/* ======================================================== */}
        <Box sx={{ mb: 3 }}>
          <Stack spacing={2}>
            {/* Fila 1: Buscador de texto, Categoría, Cafetería, Estado y Orden */}
            <Grid container spacing={1.5} alignItems="center">
              {/* Buscador de texto con icono y botón de borrado */}
              <Grid size={{ xs: 12, md: cafeteriasList.length > 1 ? 3.5 : 4.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Buscar por nombre, categoría o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#8C7A6F', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchTerm('')}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#FAF7F5',
                      fontSize: '0.85rem',
                      '& fieldset': { borderColor: '#E8E1DA' },
                      '&:hover fieldset': { borderColor: '#C8B2A1' },
                      '&.Mui-focused fieldset': { borderColor: '#4A3728' },
                    },
                  }}
                />
              </Grid>

              {/* Selector de Categoría */}
              <Grid size={{ xs: 12, sm: 6, md: cafeteriasList.length > 1 ? 2.5 : 2.5 }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={selectedCategoria}
                    onChange={(e) => setSelectedCategoria(e.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FAF7F5',
                      fontSize: '0.85rem',
                    }}
                  >
                    <MenuItem value="todas">Todas las Categorías</MenuItem>
                    {categoriasUnicas.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Selector de Cafetería (si hay más de 1) */}
              {cafeteriasList.length > 1 && (
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={selectedCafeteria}
                      onChange={(e) => setSelectedCafeteria(e.target.value)}
                      displayEmpty
                      sx={{
                        borderRadius: '12px',
                        backgroundColor: '#FAF7F5',
                        fontSize: '0.85rem',
                      }}
                    >
                      <MenuItem value="todas">Todas las Cafeterías</MenuItem>
                      {cafeteriasList.map((caf) => (
                        <MenuItem key={caf.id} value={caf.id}>
                          {caf.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Selector de Estado / Disponibilidad (SIN EMOJIS) */}
              <Grid size={{ xs: 12, sm: 6, md: cafeteriasList.length > 1 ? 2 : 2.5 }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={selectedEstado}
                    onChange={(e) => setSelectedEstado(e.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FAF7F5',
                      fontSize: '0.85rem',
                    }}
                  >
                    <MenuItem value="todos">Todos los Estados</MenuItem>
                    <MenuItem value="disponibles">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: '#2E7D32' }} />
                        Disponibles para Venta
                      </Box>
                    </MenuItem>
                    <MenuItem value="reposicion">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningAmberIcon sx={{ fontSize: 16, color: '#C62828' }} />
                        Requiere Reposición
                      </Box>
                    </MenuItem>
                    <MenuItem value="Sin Stock">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorOutlinedIcon sx={{ fontSize: 16, color: '#B71C1C' }} />
                        Sin Stock (0 unid.)
                      </Box>
                    </MenuItem>
                    <MenuItem value="Stock Bajo">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningAmberIcon sx={{ fontSize: 16, color: '#E65100' }} />
                        Stock Bajo (≤ Mínimo)
                      </Box>
                    </MenuItem>
                    <MenuItem value="optimo">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: '#2E7D32' }} />
                        Stock Óptimo
                      </Box>
                    </MenuItem>
                    <MenuItem value="inactivos">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BlockOutlinedIcon sx={{ fontSize: 16, color: '#757575' }} />
                        Inactivos / Ocultos
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Selector de Ordenamiento */}
              <Grid size={{ xs: 12, sm: 6, md: cafeteriasList.length > 1 ? 2 : 2.5 }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    startAdornment={
                      <InputAdornment position="start">
                        <SortIcon sx={{ color: '#8C7A6F', fontSize: 18 }} />
                      </InputAdornment>
                    }
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: '#FAF7F5',
                      fontSize: '0.85rem',
                    }}
                  >
                    <MenuItem value="nombre_asc">Nombre: A → Z</MenuItem>
                    <MenuItem value="nombre_desc">Nombre: Z → A</MenuItem>
                    <MenuItem value="precio_desc">Precio: Mayor a Menor</MenuItem>
                    <MenuItem value="precio_asc">Precio: Menor a Mayor</MenuItem>
                    <MenuItem value="stock_asc">Menor Stock Primero</MenuItem>
                    <MenuItem value="stock_desc">Mayor Stock Primero</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Fila 2: Chips interactivos de acceso rápido con iconos y contador */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                pt: 1,
                borderTop: '1px solid #F4EFEB',
                gap: 1.5,
              }}
            >
              {/* Chips de filtro rápido por estado con iconos */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
                <Chip
                  label={`Todos (${totalCount})`}
                  size="small"
                  onClick={() => setSelectedEstado('todos')}
                  sx={{
                    backgroundColor: selectedEstado === 'todos' ? '#4A3728' : '#FAF5F0',
                    color: selectedEstado === 'todos' ? '#FFFFFF' : '#6E5C50',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: selectedEstado === 'todos' ? '#38281E' : '#EFEAE6',
                    },
                  }}
                />
                <Chip
                  label={`Disponibles (${disponiblesCount})`}
                  size="small"
                  icon={<CheckCircleOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                  onClick={() => setSelectedEstado(selectedEstado === 'disponibles' ? 'todos' : 'disponibles')}
                  sx={{
                    backgroundColor: selectedEstado === 'disponibles' ? '#2E7D32' : '#F1F8E9',
                    color: selectedEstado === 'disponibles' ? '#FFFFFF' : '#2E7D32',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedEstado === 'disponibles' ? '#2E7D32' : '#C8E6C9',
                    '&:hover': {
                      backgroundColor: selectedEstado === 'disponibles' ? '#1B5E20' : '#E8F5E9',
                    },
                  }}
                />
                <Chip
                  label={`Stock Bajo (${stockBajoCount})`}
                  size="small"
                  icon={<WarningAmberIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                  onClick={() => setSelectedEstado(selectedEstado === 'Stock Bajo' ? 'todos' : 'Stock Bajo')}
                  sx={{
                    backgroundColor: selectedEstado === 'Stock Bajo' ? '#E65100' : '#FFF3E0',
                    color: selectedEstado === 'Stock Bajo' ? '#FFFFFF' : '#E65100',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedEstado === 'Stock Bajo' ? '#E65100' : '#FFE0B2',
                    '&:hover': {
                      backgroundColor: selectedEstado === 'Stock Bajo' ? '#BF360C' : '#FFE0B2',
                    },
                  }}
                />
                <Chip
                  label={`Sin Stock (${sinStockCount})`}
                  size="small"
                  icon={<ErrorOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                  onClick={() => setSelectedEstado(selectedEstado === 'Sin Stock' ? 'todos' : 'Sin Stock')}
                  sx={{
                    backgroundColor: selectedEstado === 'Sin Stock' ? '#B71C1C' : '#FFEBEE',
                    color: selectedEstado === 'Sin Stock' ? '#FFFFFF' : '#B71C1C',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedEstado === 'Sin Stock' ? '#B71C1C' : '#FFCDD2',
                    '&:hover': {
                      backgroundColor: selectedEstado === 'Sin Stock' ? '#880E4F' : '#FFCDD2',
                    },
                  }}
                />
                {inactivosCount > 0 && (
                  <Chip
                    label={`Inactivos (${inactivosCount})`}
                    size="small"
                    icon={<BlockOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                    onClick={() => setSelectedEstado(selectedEstado === 'inactivos' ? 'todos' : 'inactivos')}
                    sx={{
                      backgroundColor: selectedEstado === 'inactivos' ? '#616161' : '#F5F5F5',
                      color: selectedEstado === 'inactivos' ? '#FFFFFF' : '#757575',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedEstado === 'inactivos' ? '#616161' : '#E0E0E0',
                      '&:hover': {
                        backgroundColor: selectedEstado === 'inactivos' ? '#424242' : '#EEEEEE',
                      },
                    }}
                  />
                )}
              </Stack>

              {/* Botón de limpiar y contador */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                  Mostrando {filtered.length} de {productos.length} productos
                </Typography>

                {hasActiveFilters && (
                  <Button
                    size="small"
                    startIcon={<FilterAltOffIcon fontSize="small" />}
                    onClick={handleResetFilters}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#C86237',
                      textTransform: 'none',
                      py: 0.3,
                      px: 1,
                      borderRadius: '8px',
                      '&:hover': {
                        backgroundColor: '#FBE9E7',
                      },
                    }}
                  >
                    Limpiar Filtros
                  </Button>
                )}
              </Stack>
            </Box>
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

        {/* Tabla Unificada de Catálogo, Precios y Stock */}
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
                {cafeteriasList.length > 1 && (
                  <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                    CAFETERÍA
                  </TableCell>
                )}
                <TableCell align="right" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  PRECIO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  STOCK
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  MÍNIMO
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  VALOR TOTAL
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
                  <TableCell colSpan={cafeteriasList.length > 1 ? 9 : 8} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    {hasActiveFilters ? (
                      <Stack spacing={1} alignItems="center" sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                          No se encontraron productos con los criterios y filtros seleccionados.
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<FilterAltOffIcon fontSize="small" />}
                          onClick={handleResetFilters}
                          sx={{ color: '#C86237', textTransform: 'none', fontWeight: 700 }}
                        >
                          Restablecer todos los filtros
                        </Button>
                      </Stack>
                    ) : (
                      'No se encontraron productos registrados.'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((prod) => {
                  const minVal = prod.minimo ?? prod.stock_minimo ?? 0;
                  const stockNum = Number(prod.stock || 0);
                  const isSinStock = stockNum <= 0;
                  const isBajo = stockNum > 0 && stockNum <= minVal;
                  const valorFila = stockNum * Number(prod.precio || 0);

                  return (
                    <TableRow
                      key={prod.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderColor: '#F2ECE6',
                        backgroundColor: isSinStock ? 'rgba(255, 205, 210, 0.2)' : 'inherit',
                      }}
                      onClick={() => handleOpenEdit(prod)}
                    >
                      {/* Producto */}
                      <TableCell sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#3E2D22' }}>
                          {prod.nombre}
                        </Typography>
                        {prod.descripcion && (
                          <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', maxWidth: 260 }} noWrap>
                            {prod.descripcion}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Categoría */}
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

                      {/* Cafetería (si hay más de 1) */}
                      {cafeteriasList.length > 1 && (
                        <TableCell sx={{ color: '#5C4535', fontSize: '0.82rem' }}>
                          {prod.cafeteria_nombre || prod.cafeterias?.nombre || 'Cafetería Central'}
                        </TableCell>
                      )}

                      {/* Precio Unitario Modificable */}
                      <TableCell
                        align="right"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPrecio(prod);
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <Tooltip title="Clic para modificar precio">
                          <Chip
                            icon={<PriceChangeOutlinedIcon sx={{ fontSize: '15px !important', color: '#4A3728 !important' }} />}
                            label={`$${Number(prod.precio || 0).toLocaleString('es-CL')}`}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              backgroundColor: '#FAF2EA',
                              color: '#4A3728',
                              cursor: 'pointer',
                              border: '1px solid #E8D8CC',
                              '&:hover': {
                                backgroundColor: '#F5EBE1',
                                borderColor: '#C86237',
                              },
                            }}
                          />
                        </Tooltip>
                      </TableCell>

                      {/* Stock Actual Modificable */}
                      <TableCell
                        align="center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStock(prod);
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <Tooltip title="Clic para ajustar stock en bodega">
                          <Chip
                            icon={<Inventory2OutlinedIcon sx={{ fontSize: '15px !important', color: 'inherit !important' }} />}
                            label={`${prod.stock} ${prod.unidad || 'un'}`}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              backgroundColor: isSinStock ? '#FFCDD2' : isBajo ? '#FFE0B2' : '#E8F5E9',
                              color: isSinStock ? '#B71C1C' : isBajo ? '#E65100' : '#2E7D32',
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: isSinStock ? '#EF9A9A' : isBajo ? '#FFCC80' : '#A5D6A7',
                              '&:hover': {
                                filter: 'brightness(0.96)',
                              },
                            }}
                          />
                        </Tooltip>
                      </TableCell>

                      {/* Stock Mínimo */}
                      <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem', fontWeight: 600 }}>
                        {minVal} {prod.unidad || 'un'}
                      </TableCell>

                      {/* Valor Total en Stock */}
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#4A3728', fontSize: '0.85rem' }}>
                        ${valorFila.toLocaleString('es-CL')}
                      </TableCell>

                      {/* Estado */}
                      <TableCell align="center">
                        <Chip
                          icon={
                            !prod.activo ? (
                              <BlockOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />
                            ) : isSinStock ? (
                              <ErrorOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />
                            ) : isBajo ? (
                              <WarningAmberIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />
                            ) : (
                              <CheckCircleOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />
                            )
                          }
                          label={
                            !prod.activo
                              ? 'INACTIVO'
                              : isSinStock
                              ? 'SIN STOCK'
                              : isBajo
                              ? 'STOCK BAJO'
                              : 'ÓPTIMO'
                          }
                          size="small"
                          sx={{
                            backgroundColor:
                              !prod.activo
                                ? '#EEEEEE'
                                : isSinStock
                                ? '#FFEBEE'
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
                            border: '1px solid',
                            borderColor:
                              !prod.activo
                                ? '#E0E0E0'
                                : isSinStock
                                ? '#FFCDD2'
                                : isBajo
                                ? '#FFE0B2'
                                : '#C8E6C9',
                          }}
                        />
                      </TableCell>

                      {/* Acciones Rápidas Integradas */}
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                          <Tooltip title="Modificar Precio">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPrecio(prod)}
                              sx={{
                                color: '#C86237',
                                '&:hover': { backgroundColor: 'rgba(200, 98, 55, 0.1)' },
                              }}
                            >
                              <PriceChangeOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Modificar Stock">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenStock(prod)}
                              sx={{
                                color: '#4A3728',
                                '&:hover': { backgroundColor: 'rgba(74, 55, 40, 0.1)' },
                              }}
                            >
                              <Inventory2OutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Editar Producto Completo">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(prod)}
                              sx={{
                                color: '#78665B',
                                '&:hover': { backgroundColor: 'rgba(120, 102, 91, 0.1)' },
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Eliminar Producto">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDelete(prod)}
                              sx={{
                                color: '#D32F2F',
                                '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.1)' },
                              }}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
      {/* FORMULARIO DE CREACIÓN DE PRODUCTO                        */}
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
      {/* FORMULARIO DE EDICIÓN DE PRODUCTO EXISTENTE               */}
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
      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN                    */}
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

      {/* ======================================================== */}
      {/* OPERACIÓN DE MODIFICAR PRECIO                            */}
      {/* ======================================================== */}
      <ModificarPrecioDialog
        open={precioDialogOpen}
        onClose={() => {
          setPrecioDialogOpen(false);
          setProductoParaPrecio(null);
        }}
        producto={productoParaPrecio}
        onSuccess={handlePrecioSuccess}
      />

      {/* ======================================================== */}
      {/* OPERACIÓN DE MODIFICAR STOCK                             */}
      {/* ======================================================== */}
      <ModificarStockDialog
        open={stockDialogOpen}
        onClose={() => {
          setStockDialogOpen(false);
          setProductoParaStock(null);
        }}
        producto={productoParaStock}
        onSuccess={handleStockSuccess}
      />

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
