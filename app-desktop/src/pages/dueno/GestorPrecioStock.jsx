import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Stack,
  TextField,
  IconButton,
  Tooltip,
  LinearProgress,
  Snackbar,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';

import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import SortIcon from '@mui/icons-material/Sort';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { productos as productosService } from '../../service/productos';
import { categorias as categoriasService } from '../../service/categorias';
import ModificarPrecioDialog from '../../components/productos/ModificarPrecioDialog';
import ModificarStockDialog from '../../components/productos/ModificarStockDialog';

/**
 * Gestor de Precio y Stock Dueño
 * Permite supervisar valores actuales y separar claramente las operaciones de:
 * 1. Modificar Precio: Validación de precios > 0, actualización en Supabase.
 * 2. Modificar Stock: Validación de stock no negativo (>= 0), alertas y actualización en Supabase.
 */
function GestorPrecioStock({ currentUser }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [sortBy, setSortBy] = useState('urgencia');

  // Diálogo dedicado para Modificar Precio
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false);
  const [productoParaPrecio, setProductoParaPrecio] = useState(null);

  // Diálogo dedicado para Modificar Stock
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [productoParaStock, setProductoParaStock] = useState(null);

  // Notificaciones Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsData, catsData] = await Promise.all([
        productosService.getAll(),
        categoriasService.getAll(),
      ]);
      setProductos(prodsData || []);
      setCategorias(catsData || []);
    } catch (err) {
      console.error('Error al cargar datos en Gestor de Precio y Stock:', err);
      setSnackbar({
        open: true,
        message: 'Error al conectar con la base de datos.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado y ordenamiento avanzado de productos
  const filteredProductos = useMemo(() => {
    const result = productos.filter((p) => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.categoria || '').toLowerCase().includes(term);

      const matchCat =
        selectedCategoria === 'todas' ||
        String(p.categoria_id) === String(selectedCategoria) ||
        (p.categoria || '').toLowerCase() === selectedCategoria.toLowerCase();

      const stockNum = Number(p.stock || 0);
      const minNum = Number(p.stock_minimo ?? p.minimo ?? 0);
      const isSinStock = stockNum <= 0;
      const isBajo = stockNum > 0 && stockNum <= minNum;
      const isOptimo = stockNum > minNum;

      let matchEstado = true;
      if (selectedEstado === 'reposicion') {
        matchEstado = isSinStock || isBajo;
      } else if (selectedEstado === 'Sin Stock') {
        matchEstado = isSinStock;
      } else if (selectedEstado === 'Stock Bajo') {
        matchEstado = isBajo;
      } else if (selectedEstado === 'Optimo') {
        matchEstado = isOptimo;
      }

      return matchSearch && matchCat && matchEstado;
    });

    result.sort((a, b) => {
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      const minA = Number(a.stock_minimo ?? a.minimo ?? 0);
      const minB = Number(b.stock_minimo ?? b.minimo ?? 0);
      const precioA = Number(a.precio || 0);
      const precioB = Number(b.precio || 0);

      if (sortBy === 'urgencia') {
        return (stockA - minA) - (stockB - minB);
      }
      if (sortBy === 'precio_desc') {
        return precioB - precioA;
      }
      if (sortBy === 'precio_asc') {
        return precioA - precioB;
      }
      if (sortBy === 'stock_asc') {
        return stockA - stockB;
      }
      if (sortBy === 'stock_desc') {
        return stockB - stockA;
      }
      if (sortBy === 'nombre_asc') {
        return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return (b.nombre || '').localeCompare(a.nombre || '', 'es', { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [productos, searchTerm, selectedCategoria, selectedEstado, sortBy]);

  // Estadísticas rápidas y Valorización Total del Inventario para el Dueño
  const stats = useMemo(() => {
    const total = productos.length;
    const sinStock = productos.filter((p) => Number(p.stock || 0) <= 0).length;
    const stockBajo = productos.filter((p) => {
      const s = Number(p.stock || 0);
      const m = Number(p.stock_minimo ?? p.minimo ?? 0);
      return s > 0 && s <= m;
    }).length;
    const optimos = productos.filter((p) => {
      const s = Number(p.stock || 0);
      const m = Number(p.stock_minimo ?? p.minimo ?? 0);
      return s > m;
    }).length;
    const precioPromedio =
      total > 0
        ? Math.round(productos.reduce((acc, p) => acc + Number(p.precio || 0), 0) / total)
        : 0;
    const valorInventario = productos.reduce(
      (acc, p) => acc + Number(p.precio || 0) * Number(p.stock || 0),
      0
    );

    return { total, sinStock, stockBajo, optimos, precioPromedio, valorInventario };
  }, [productos]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategoria('todas');
    setSelectedEstado('todos');
    setSortBy('urgencia');
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() !== '' ||
    selectedCategoria !== 'todas' ||
    selectedEstado !== 'todos' ||
    sortBy !== 'urgencia'
  );

  // Manejo de apertura de diálogo de precio
  const handleOpenPrecioDialog = (producto) => {
    setProductoParaPrecio(producto);
    setPrecioDialogOpen(true);
  };

  // Manejo de apertura de diálogo de stock
  const handleOpenStockDialog = (producto) => {
    setProductoParaStock(producto);
    setStockDialogOpen(true);
  };

  // Callback al actualizar exitosamente precio en Supabase
  const handlePrecioSuccess = (updatedItem, message) => {
    setProductos((prev) =>
      prev.map((p) => (p.id === updatedItem.id ? { ...p, ...updatedItem } : p))
    );
    setSnackbar({
      open: true,
      message: message || 'Precio actualizado exitosamente en Supabase.',
      severity: 'success',
    });
  };

  // Callback al actualizar exitosamente stock en Supabase
  const handleStockSuccess = (updatedItem, message) => {
    setProductos((prev) =>
      prev.map((p) => (p.id === updatedItem.id ? { ...p, ...updatedItem } : p))
    );
    setSnackbar({
      open: true,
      message: message || 'Stock actualizado exitosamente en Supabase.',
      severity: 'success',
    });
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* 1. Encabezado de la Pantalla */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
          >
            Gestor de Precio y Stock Dueño
          </Typography>
          <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
            Operaciones de precios de venta y niveles de existencias
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
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
          {loading ? 'Cargando...' : 'Actualizar Datos'}
        </Button>
      </Box>

      {/* 2. Tarjetas de Resumen y Valorización de Inventario (Interactivas) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Insumos */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title="Ver todos los productos">
            <Card
              elevation={0}
              onClick={() => setSelectedEstado('todos')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'todos' && !hasActiveFilters ? '2px solid #4A3728' : '1px solid #EFEAE6',
                bgcolor: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(74, 55, 40, 0.1)' },
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
                      Total Catálogo
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22' }}>
                      {stats.total}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Stock Bajo Mínimo */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title={selectedEstado === 'Stock Bajo' ? 'Quitar filtro' : 'Filtrar productos bajo el mínimo'}>
            <Card
              elevation={0}
              onClick={() => setSelectedEstado(selectedEstado === 'Stock Bajo' ? 'todos' : 'Stock Bajo')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'Stock Bajo' ? '2px solid #E65100' : stats.stockBajo > 0 ? '1px solid #FFE0B2' : '1px solid #EFEAE6',
                bgcolor: stats.stockBajo > 0 ? '#FFF3E0' : '#FFFFFF',
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
                      bgcolor: stats.stockBajo > 0 ? '#FFE0B2' : '#F5F5F5',
                      color: stats.stockBajo > 0 ? '#E65100' : '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrendingDownIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Stock Bajo Mín.
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ color: stats.stockBajo > 0 ? '#E65100' : '#3E2D22' }}
                    >
                      {stats.stockBajo}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Sin Stock */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Tooltip title={selectedEstado === 'Sin Stock' ? 'Quitar filtro' : 'Filtrar productos agotados'}>
            <Card
              elevation={0}
              onClick={() => setSelectedEstado(selectedEstado === 'Sin Stock' ? 'todos' : 'Sin Stock')}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: selectedEstado === 'Sin Stock' ? '2px solid #B71C1C' : stats.sinStock > 0 ? '1px solid #FFCDD2' : '1px solid #EFEAE6',
                bgcolor: stats.sinStock > 0 ? '#FFEBEE' : '#FFFFFF',
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
                      bgcolor: stats.sinStock > 0 ? '#FFCDD2' : '#F5F5F5',
                      color: stats.sinStock > 0 ? '#B71C1C' : '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ErrorOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Sin Stock (0)
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ color: stats.sinStock > 0 ? '#B71C1C' : '#3E2D22' }}
                    >
                      {stats.sinStock}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        {/* Valorización Total del Inventario */}
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
                    ${stats.valorInventario.toLocaleString('es-CL')}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Precio Promedio */}
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
                    bgcolor: '#FAF2EA',
                    color: '#C86237',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AttachMoneyIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                    Precio Promedio
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22' }}>
                    ${stats.precioPromedio.toLocaleString('es-CL')}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 3. Panel de Búsqueda y Filtros Avanzados */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '16px',
          border: '1px solid #EFEAE6',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        }}
      >
        <Stack spacing={2}>
          {/* Fila 1 de Controles: Texto, Categoría, Estado y Ordenamiento */}
          <Grid container spacing={2} alignItems="center">
            {/* Buscador de texto */}
            <Grid size={{ xs: 12, md: 4.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar por producto o categoría..."
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
                  },
                }}
              />
            </Grid>

            {/* Selector de Categoría */}
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
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
                  {categorias.map((c) => (
                    <MenuItem key={c.id} value={c.nombre || c.id}>
                      {c.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Selector de Estado de Stock */}
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
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
                  <MenuItem value="reposicion">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningAmberIcon sx={{ fontSize: 16, color: '#C62828' }} />
                      Requiere Reposición
                    </Box>
                  </MenuItem>
                  <MenuItem value="Sin Stock">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ErrorOutlinedIcon sx={{ fontSize: 16, color: '#B71C1C' }} />
                      Sin Stock (Agotados)
                    </Box>
                  </MenuItem>
                  <MenuItem value="Stock Bajo">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningAmberIcon sx={{ fontSize: 16, color: '#E65100' }} />
                      Stock Bajo (≤ Mínimo)
                    </Box>
                  </MenuItem>
                  <MenuItem value="Optimo">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: '#2E7D32' }} />
                      Óptimos
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Selector de Ordenamiento */}
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
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
                  <MenuItem value="urgencia">Mayor Urgencia (Stock vs Mín)</MenuItem>
                  <MenuItem value="precio_desc">Precio: Mayor a Menor</MenuItem>
                  <MenuItem value="precio_asc">Precio: Menor a Mayor</MenuItem>
                  <MenuItem value="stock_asc">Menor Stock Disponible</MenuItem>
                  <MenuItem value="stock_desc">Mayor Stock Disponible</MenuItem>
                  <MenuItem value="nombre_asc">Nombre: A → Z</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Fila 2 de Chips de acceso rápido y botón Limpiar */}
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
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              <Chip
                label={`Todos (${stats.total})`}
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
                label={`Requiere Reposición (${stats.sinStock + stats.stockBajo})`}
                size="small"
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'reposicion' ? 'todos' : 'reposicion')}
                sx={{
                  backgroundColor: selectedEstado === 'reposicion' ? '#D32F2F' : '#FFEBEE',
                  color: selectedEstado === 'reposicion' ? '#FFFFFF' : '#C62828',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
              <Chip
                label={`Sin Stock (${stats.sinStock})`}
                size="small"
                icon={<ErrorOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Sin Stock' ? 'todos' : 'Sin Stock')}
                sx={{
                  backgroundColor: selectedEstado === 'Sin Stock' ? '#B71C1C' : '#FFCDD2',
                  color: selectedEstado === 'Sin Stock' ? '#FFFFFF' : '#B71C1C',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
              <Chip
                label={`Stock Bajo (${stats.stockBajo})`}
                size="small"
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Stock Bajo' ? 'todos' : 'Stock Bajo')}
                sx={{
                  backgroundColor: selectedEstado === 'Stock Bajo' ? '#C62828' : '#FFEBEE',
                  color: selectedEstado === 'Stock Bajo' ? '#FFFFFF' : '#C62828',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
              <Chip
                label={`Óptimos (${stats.optimos})`}
                size="small"
                icon={<CheckCircleOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Optimo' ? 'todos' : 'Optimo')}
                sx={{
                  backgroundColor: selectedEstado === 'Optimo' ? '#2E7D32' : '#E8F5E9',
                  color: selectedEstado === 'Optimo' ? '#FFFFFF' : '#2E7D32',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="caption" sx={{ color: '#78665B', fontWeight: 600 }}>
                Mostrando <b>{filteredProductos.length}</b> de <b>{productos.length}</b> productos
              </Typography>

              {hasActiveFilters && (
                <Button
                  size="small"
                  startIcon={<FilterAltOffIcon fontSize="small" />}
                  onClick={handleResetFilters}
                  sx={{
                    color: '#C86237',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    py: 0.2,
                    px: 1,
                  }}
                >
                  Limpiar Filtros
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* 4. Tabla Principal: Valores Actuales y Operaciones Separadas */}
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
                <TableCell align="right" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  PRECIO ACTUAL
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  OP. PRECIO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  STOCK ACTUAL
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  MÍNIMO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  ESTADO STOCK
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  OP. STOCK
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredProductos.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    No se encontraron productos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProductos.map((p) => {
                  const stockNum = Number(p.stock || 0);
                  const minNum = Number(p.stock_minimo ?? p.minimo ?? 0);
                  const isSinStock = stockNum <= 0;
                  const isBajo = stockNum > 0 && stockNum <= minNum;
                  const unidad = p.unidad || 'un';

                  return (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{
                        backgroundColor: isSinStock
                          ? 'rgba(255, 205, 210, 0.25)'
                          : isBajo
                          ? 'rgba(255, 243, 224, 0.3)'
                          : 'inherit',
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderColor: '#F2ECE6',
                      }}
                    >
                      {/* Nombre y cafetería */}
                      <TableCell sx={{ fontWeight: 700, color: '#3E2D22', fontSize: '0.85rem' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#3E2D22' }}>
                          {p.nombre}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
                          {p.cafeteria_nombre || 'Cafetería Central'}
                        </Typography>
                      </TableCell>

                      {/* Categoría */}
                      <TableCell>
                        <Chip
                          label={p.categoria || 'GENERAL'}
                          size="small"
                          sx={{
                            backgroundColor: p.catBg || '#EFEBE9',
                            color: p.catColor || '#8D6E63',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      {/* VALOR ACTUAL DE PRECIO */}
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#3E2D22', fontSize: '0.9rem' }}>
                        ${Number(p.precio || 0).toLocaleString('es-CL')}
                      </TableCell>

                      {/* OPERACIÓN SEPARADA: MODIFICAR PRECIO */}
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PriceChangeOutlinedIcon fontSize="small" />}
                          onClick={() => handleOpenPrecioDialog(p)}
                          sx={{
                            borderColor: '#C8B2A1',
                            color: '#C86237',
                            backgroundColor: '#FAF5F1',
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            py: 0.5,
                            px: 1.5,
                            '&:hover': {
                              borderColor: '#C86237',
                              backgroundColor: '#F5EBE1',
                            },
                          }}
                        >
                          Modificar Precio
                        </Button>
                      </TableCell>

                      {/* VALOR ACTUAL DE STOCK */}
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          color: isSinStock ? '#B71C1C' : isBajo ? '#E65100' : '#3E2D22',
                        }}
                      >
                        {stockNum} {unidad}
                      </TableCell>

                      {/* Mínimo requerido */}
                      <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                        {minNum} {unidad}
                      </TableCell>

                      {/* Estado actual de Stock */}
                      <TableCell align="center">
                        <Chip
                          label={isSinStock ? 'SIN STOCK' : isBajo ? 'STOCK BAJO' : 'ÓPTIMO'}
                          size="small"
                          sx={{
                            backgroundColor: isSinStock
                              ? '#FFCDD2'
                              : isBajo
                              ? '#FFE0B2'
                              : '#E8F5E9',
                            color: isSinStock
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

                      {/* OPERACIÓN SEPARADA: MODIFICAR STOCK */}
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Inventory2OutlinedIcon fontSize="small" />}
                          onClick={() => handleOpenStockDialog(p)}
                          sx={{
                            borderColor: '#C8B2A1',
                            color: '#4A3728',
                            backgroundColor: '#F7F4F1',
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            py: 0.5,
                            px: 1.5,
                            '&:hover': {
                              borderColor: '#4A3728',
                              backgroundColor: '#EFEBE6',
                            },
                          }}
                        >
                          Modificar Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Diálogo de Modificar Precio */}
      <ModificarPrecioDialog
        open={precioDialogOpen}
        onClose={() => {
          setPrecioDialogOpen(false);
          setProductoParaPrecio(null);
        }}
        producto={productoParaPrecio}
        onSuccess={handlePrecioSuccess}
      />

      {/* Diálogo de Modificar Stock */}
      <ModificarStockDialog
        open={stockDialogOpen}
        onClose={() => {
          setStockDialogOpen(false);
          setProductoParaStock(null);
        }}
        producto={productoParaStock}
        onSuccess={handleStockSuccess}
      />

      {/* Snackbar de notificaciones de actualización */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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

export default GestorPrecioStock;
