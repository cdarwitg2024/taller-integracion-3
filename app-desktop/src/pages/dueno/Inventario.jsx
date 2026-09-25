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
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  TextField,
  FormControl,
  Select,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import TelegramIcon from '@mui/icons-material/Telegram';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import SortIcon from '@mui/icons-material/Sort';

import { productos as productosService } from '../../service/productos';
import { alertasStock as alertasService } from '../../service/alertas_stock';
import { telegramDuenoService } from '../../service/telegram_dueno';
import TelegramConfigModal from '../../components/telegram/TelegramConfigModal';
import ModificarStockDialog from '../../components/productos/ModificarStockDialog';

function StockInventario({ currentUser }) {
  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [telegramConfig, setTelegramConfig] = useState(null);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramMenuAnchor, setTelegramMenuAnchor] = useState(null);
  const [confirmUnlinkDialogOpen, setConfirmUnlinkDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Diálogo para Modificar Stock (FR-47)
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [productoParaStock, setProductoParaStock] = useState(null);

  const handleOpenStockDialog = (row) => {
    setProductoParaStock({
      id: row.id,
      nombre: row.insumo,
      stock: row.actual,
      stock_minimo: row.minimo,
      minimo: row.minimo,
      unidad: row.unidad,
      categoria: row.categoria,
    });
    setStockDialogOpen(true);
  };

  const handleStockSuccess = async (updatedProd, message) => {
    setSnackbar({
      open: true,
      message: message || 'Stock actualizado exitosamente en Supabase.',
      severity: 'success',
    });
    await loadData();
  };

  const duenoId = currentUser?.id || 1;
  const cafeteriaId = currentUser?.cafeteria_id || 1;

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsData, alertasData, tgConfig] = await Promise.all([
        productosService.getAll(),
        alertasService.getNoLeidas(cafeteriaId),
        telegramDuenoService.getConfiguracion(duenoId),
      ]);
      setTelegramConfig(tgConfig);


      const formatted = prodsData.map((p) => {
        const actual = Number(p.stock || 0);
        const minimo = Number(p.stock_minimo ?? p.minimo ?? 0);
        const diferencia = actual - minimo;

        let estado = 'Óptimo';
        if (actual <= 0) {
          estado = 'Sin Stock';
        } else if (actual <= minimo) {
          estado = 'Crítico';
        } else if (actual <= minimo * 1.3) {
          estado = 'Atención';
        }

        return {
          id: p.id,
          insumo: p.nombre,
          categoria: p.categoria || p.categorias?.nombre || 'General',
          actual,
          minimo,
          diferencia,
          unidad: p.unidad || 'un',
          estado,
        };
      });

      setItems(formatted);
      setAlertas(alertasData || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sinStockCount = items.filter((i) => i.estado === 'Sin Stock').length;
  const criticosCount = items.filter((i) => i.estado === 'Crítico').length;
  const atencionCount = items.filter((i) => i.estado === 'Atención').length;
  const optimosCount = items.filter((i) => i.estado === 'Óptimo').length;

  // Estados de Búsqueda y Filtros Avanzados
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [sortBy, setSortBy] = useState('urgencia');

  // Categorías únicas dinámicas
  const categoriasList = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Filtrado y ordenamiento avanzado de insumos
  const filteredItems = useMemo(() => {
    const result = items.filter((item) => {
      // 1. Filtro por término de búsqueda (insumo, categoría, unidad)
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        item.insumo.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        item.unidad.toLowerCase().includes(term);

      // 2. Filtro por categoría
      const matchCat =
        selectedCategoria === 'todas' ||
        item.categoria.toLowerCase() === selectedCategoria.toLowerCase();

      // 3. Filtro por estado
      let matchEstado = true;
      if (selectedEstado === 'reposicion') {
        matchEstado = item.estado === 'Sin Stock' || item.estado === 'Crítico';
      } else if (selectedEstado !== 'todos') {
        matchEstado = item.estado.toLowerCase() === selectedEstado.toLowerCase();
      }

      return matchSearch && matchCat && matchEstado;
    });

    // 4. Ordenamiento inteligente
    result.sort((a, b) => {
      if (sortBy === 'urgencia') {
        return a.diferencia - b.diferencia;
      }
      if (sortBy === 'stock_asc') {
        return a.actual - b.actual;
      }
      if (sortBy === 'stock_desc') {
        return b.actual - a.actual;
      }
      if (sortBy === 'nombre_asc') {
        return a.insumo.localeCompare(b.insumo, 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return b.insumo.localeCompare(a.insumo, 'es', { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [items, searchTerm, selectedCategoria, selectedEstado, sortBy]);

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

  const handleExport = () => {
    const listToExport = filteredItems.length > 0 ? filteredItems : items;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Insumo,Categoria,Stock Disponible,Minimo Requerido,Balance vs Minimo,Unidad,Estado\n' +
      listToExport
        .map(
          (e) =>
            `"${e.insumo}","${e.categoria}",${e.actual},${e.minimo},${e.diferencia},"${e.unidad}","${e.estado}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `inventario_coffeefaster_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
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
            variant="h5"
            fontWeight={800}
            sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
          >
            Control de Stock e Inventario
          </Typography>
          <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
            Supervisión directa de umbrales mínimos y balances de reposición
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<TelegramIcon sx={{ color: telegramConfig?.telegram_chat_id ? '#2E7D32' : '#B45309' }} />}
            endIcon={telegramConfig?.telegram_chat_id ? <KeyboardArrowDownIcon /> : null}
            onClick={(e) => {
              if (telegramConfig?.telegram_chat_id) {
                setTelegramMenuAnchor(e.currentTarget);
              } else {
                setTelegramModalOpen(true);
              }
            }}
            sx={{
              borderColor: telegramConfig?.telegram_chat_id ? '#81C784' : '#F59E0B',
              backgroundColor: telegramConfig?.telegram_chat_id ? '#F1F8E9' : '#FEF3C7',
              color: telegramConfig?.telegram_chat_id ? '#2E7D32' : '#92400E',
              borderRadius: '10px',
              textTransform: 'none',
              px: 2,
              py: 1,
              fontWeight: 700,
              boxShadow: telegramConfig?.telegram_chat_id ? 'none' : '0 1px 4px rgba(245, 158, 11, 0.15)',
              '&:hover': {
                borderColor: telegramConfig?.telegram_chat_id ? '#4CAF50' : '#D97706',
                backgroundColor: telegramConfig?.telegram_chat_id ? '#E8F5E9' : '#FDE68A',
              },
            }}
          >
            {telegramConfig?.telegram_chat_id ? 'Telegram: Conectado' : 'Vincular Telegram'}
          </Button>

          {/* Menú de Opciones del Botón de Telegram */}
          <Menu
            anchorEl={telegramMenuAnchor}
            open={Boolean(telegramMenuAnchor)}
            onClose={() => setTelegramMenuAnchor(null)}
            PaperProps={{
              sx: {
                borderRadius: '14px',
                minWidth: 230,
                boxShadow: '0 10px 28px rgba(67, 50, 37, 0.12)',
                border: '1px solid #EFEAE6',
                mt: 0.8,
              },
            }}
          >
            <MenuItem
              onClick={() => {
                setTelegramMenuAnchor(null);
                setTelegramModalOpen(true);
              }}
              sx={{ py: 1.2 }}
            >
              <ListItemIcon sx={{ color: '#4A3728' }}>
                <SettingsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Ver Estado y Ajustes"
                secondary={`Chat ID: ${telegramConfig?.telegram_chat_id}`}
                secondaryTypographyProps={{ fontSize: '0.72rem' }}
              />
            </MenuItem>

            <MenuItem
              onClick={async () => {
                setTelegramMenuAnchor(null);
                try {
                  const res = await telegramDuenoService.enviarAlertaPrueba({
                    usuarioId: duenoId,
                    cafeteriaId: cafeteriaId,
                    telegramChatId: telegramConfig.telegram_chat_id,
                  });
                  setSnackbar({
                    open: true,
                    message: res.message || 'Alerta de prueba enviada a Telegram.',
                    severity: 'success',
                  });
                } catch {
                  setSnackbar({
                    open: true,
                    message: 'No se pudo enviar la alerta de prueba.',
                    severity: 'error',
                  });
                }
              }}
              sx={{ py: 1.2 }}
            >
              <ListItemIcon sx={{ color: '#2E7D32' }}>
                <SendOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Enviar Alerta de Prueba" />
            </MenuItem>

            <Divider sx={{ my: 0.5 }} />

            <MenuItem
              onClick={() => {
                setTelegramMenuAnchor(null);
                setConfirmUnlinkDialogOpen(true);
              }}
              sx={{ color: '#D32F2F', py: 1.2 }}
            >
              <ListItemIcon sx={{ color: '#D32F2F' }}>
                <DeleteOutlineOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Desvincular Chat" />
            </MenuItem>
          </Menu>


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
              px: 2,
              py: 1,
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
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={{
              borderColor: '#C8B2A1',
              color: '#4A3728',
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5,
              py: 1,
              fontWeight: 600,
              '&:hover': {
                borderColor: '#4A3728',
                backgroundColor: '#FAF7F4',
              },
            }}
          >
            Exportar Reporte
          </Button>
        </Stack>
      </Box>




      {/* Letreros de alerta condicionales: Interactivos como filtros rápidos */}
      {(sinStockCount > 0 || criticosCount > 0 || atencionCount > 0) && (
        <Grid container spacing={2.5} sx={{ width: '100%', mb: 3 }}>
          {sinStockCount > 0 && (
            <Grid size={{ xs: 12, sm: criticosCount > 0 || atencionCount > 0 ? 4 : 12 }}>
              <Tooltip title={selectedEstado === 'Sin Stock' ? 'Quitar filtro de Sin Stock' : 'Filtrar solo insumos Sin Stock'}>
                <Card
                  elevation={0}
                  onClick={() => setSelectedEstado(selectedEstado === 'Sin Stock' ? 'todos' : 'Sin Stock')}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    border: selectedEstado === 'Sin Stock' ? '2px solid #B71C1C' : '1px solid #EF9A9A',
                    bgcolor: '#FFEBEE',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedEstado === 'Sin Stock' ? '0 4px 14px rgba(183, 28, 28, 0.25)' : 'none',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(183, 28, 28, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Stack direction="row" spacing={1.8} alignItems="center">
                      <ErrorOutlinedIcon sx={{ color: '#B71C1C', fontSize: 36 }} />
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#B71C1C' }}>
                            {sinStockCount} Insumo{sinStockCount > 1 ? 's' : ''} Sin Stock
                          </Typography>
                          {selectedEstado === 'Sin Stock' && (
                            <Chip label="ACTIVO" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#B71C1C', color: '#FFF', fontWeight: 800 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#C62828', display: 'block' }}>
                          0 unidades disponibles. Clic para filtrar.
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
          )}

          {criticosCount > 0 && (
            <Grid size={{ xs: 12, sm: sinStockCount > 0 ? 4 : atencionCount > 0 ? 6 : 12 }}>
              <Tooltip title={selectedEstado === 'Crítico' ? 'Quitar filtro de Críticos' : 'Filtrar solo insumos Críticos'}>
                <Card
                  elevation={0}
                  onClick={() => setSelectedEstado(selectedEstado === 'Crítico' ? 'todos' : 'Crítico')}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    border: selectedEstado === 'Crítico' ? '2px solid #C62828' : '1px solid #FFCDD2',
                    bgcolor: '#FFEBEE',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedEstado === 'Crítico' ? '0 4px 14px rgba(198, 40, 40, 0.25)' : 'none',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(198, 40, 40, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Stack direction="row" spacing={1.8} alignItems="center">
                      <ErrorOutlinedIcon sx={{ color: '#C62828', fontSize: 36 }} />
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#B71C1C' }}>
                            {criticosCount} Insumo{criticosCount > 1 ? 's' : ''} Crítico{criticosCount > 1 ? 's' : ''}
                          </Typography>
                          {selectedEstado === 'Crítico' && (
                            <Chip label="ACTIVO" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#C62828', color: '#FFF', fontWeight: 800 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#C62828', display: 'block' }}>
                          Stock igual o menor al mínimo requerido. Clic para filtrar.
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
          )}

          {atencionCount > 0 && (
            <Grid size={{ xs: 12, sm: sinStockCount > 0 ? 4 : criticosCount > 0 ? 6 : 12 }}>
              <Tooltip title={selectedEstado === 'Atención' ? 'Quitar filtro de Advertencia' : 'Filtrar insumos en Advertencia'}>
                <Card
                  elevation={0}
                  onClick={() => setSelectedEstado(selectedEstado === 'Atención' ? 'todos' : 'Atención')}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    border: selectedEstado === 'Atención' ? '2px solid #E65100' : '1px solid #FFE0B2',
                    bgcolor: '#FFF3E0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedEstado === 'Atención' ? '0 4px 14px rgba(230, 81, 0, 0.25)' : 'none',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(230, 81, 0, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Stack direction="row" spacing={1.8} alignItems="center">
                      <WarningAmberIcon sx={{ color: '#E65100', fontSize: 36 }} />
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#E65100' }}>
                            {atencionCount} Insumo{atencionCount > 1 ? 's' : ''} en Advertencia
                          </Typography>
                          {selectedEstado === 'Atención' && (
                            <Chip label="ACTIVO" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#E65100', color: '#FFF', fontWeight: 800 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#BF360C', display: 'block' }}>
                          Próximos a cruzar el umbral mínimo. Clic para filtrar.
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
          )}
        </Grid>
      )}

      {/* ======================================================== */}
      {/* PANEL DE BÚSQUEDA Y FILTROS AVANZADOS DE INVENTARIO       */}
      {/* ======================================================== */}
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
          {/* Fila 1: Buscador de texto, Categoría, Estado de Stock y Ordenamiento */}
          <Grid container spacing={2} alignItems="center">
            {/* Buscador de texto */}
            <Grid size={{ xs: 12, md: 4.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar por insumo, categoría o unidad..."
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
                  {categoriasList.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
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
                  <MenuItem value="Crítico">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ErrorOutlinedIcon sx={{ fontSize: 16, color: '#C62828' }} />
                      Críticos (≤ Mínimo)
                    </Box>
                  </MenuItem>
                  <MenuItem value="Atención">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningAmberIcon sx={{ fontSize: 16, color: '#E65100' }} />
                      En Advertencia
                    </Box>
                  </MenuItem>
                  <MenuItem value="Óptimo">
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
                  <MenuItem value="urgencia">Mayor Urgencia (Balance)</MenuItem>
                  <MenuItem value="stock_asc">Menor Stock Disponible</MenuItem>
                  <MenuItem value="stock_desc">Mayor Stock Disponible</MenuItem>
                  <MenuItem value="nombre_asc">Nombre: A → Z</MenuItem>
                  <MenuItem value="nombre_desc">Nombre: Z → A</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Fila 2: Chips interactivos de acceso rápido y resumen */}
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
            {/* Chips de filtro rápido por estado */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              <Chip
                label={`Todos (${items.length})`}
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
                label={`Requiere Reposición (${sinStockCount + criticosCount})`}
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
                label={`Sin Stock (${sinStockCount})`}
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
                label={`Críticos (${criticosCount})`}
                size="small"
                icon={<ErrorOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Crítico' ? 'todos' : 'Crítico')}
                sx={{
                  backgroundColor: selectedEstado === 'Crítico' ? '#C62828' : '#FFEBEE',
                  color: selectedEstado === 'Crítico' ? '#FFFFFF' : '#C62828',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
              <Chip
                label={`Advertencia (${atencionCount})`}
                size="small"
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Atención' ? 'todos' : 'Atención')}
                sx={{
                  backgroundColor: selectedEstado === 'Atención' ? '#E65100' : '#FFF3E0',
                  color: selectedEstado === 'Atención' ? '#FFFFFF' : '#E65100',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
              <Chip
                label={`Óptimos (${optimosCount})`}
                size="small"
                icon={<CheckCircleOutlinedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                onClick={() => setSelectedEstado(selectedEstado === 'Óptimo' ? 'todos' : 'Óptimo')}
                sx={{
                  backgroundColor: selectedEstado === 'Óptimo' ? '#2E7D32' : '#E8F5E9',
                  color: selectedEstado === 'Óptimo' ? '#FFFFFF' : '#2E7D32',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              />
            </Stack>

            {/* Resumen de resultados y botón Limpiar Filtros */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="caption" sx={{ color: '#78665B', fontWeight: 600 }}>
                Mostrando <b>{filteredItems.length}</b> de <b>{items.length}</b> insumos
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

      {/* Tabla Principal de Inventario */}
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
                  INSUMO / ARTÍCULO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  STOCK DISPONIBLE
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  MÍNIMO REQUERIDO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  BALANCE vs MÍNIMO
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
              {filteredItems.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    {hasActiveFilters
                      ? 'No se encontraron insumos que coincidan con los filtros aplicados.'
                      : 'No hay insumos registrados en inventario.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((row) => {
                  const isSinStock = row.estado === 'Sin Stock';
                  const isCritico = row.estado === 'Crítico';
                  const isAtencion = row.estado === 'Atención';

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        backgroundColor: isSinStock
                          ? 'rgba(255, 205, 210, 0.4)'
                          : isCritico
                          ? 'rgba(255, 235, 238, 0.3)'
                          : 'inherit',
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderColor: '#F2ECE6',
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#3E2D22' }}>
                          {row.insumo}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
                          {row.categoria}
                        </Typography>
                      </TableCell>

                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 800,
                          color: isSinStock ? '#B71C1C' : isCritico ? '#C62828' : '#3E2D22',
                          fontSize: '0.88rem',
                        }}
                      >
                        {row.actual} {row.unidad}
                      </TableCell>

                      <TableCell
                        align="center"
                        sx={{ color: '#78665B', fontSize: '0.88rem', fontWeight: 600 }}
                      >
                        {row.minimo} {row.unidad}
                      </TableCell>

                      {/* Balance numérico real vs mínimo (reemplaza las barras de progreso sin sentido) */}
                      <TableCell align="center">
                        {row.diferencia < 0 ? (
                          <Chip
                            size="small"
                            icon={<TrendingDownIcon sx={{ '&&': { color: isSinStock ? '#B71C1C' : '#C62828', fontSize: 16 } }} />}
                            label={isSinStock ? `Agotado (0 ${row.unidad})` : `Faltan ${Math.abs(row.diferencia)} ${row.unidad}`}
                            sx={{
                              backgroundColor: isSinStock ? '#FFCDD2' : '#FFEBEE',
                              color: isSinStock ? '#B71C1C' : '#C62828',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              borderRadius: '8px',
                              border: isSinStock ? '1px solid #EF9A9A' : '1px solid #FFCDD2',
                              px: 0.5,
                            }}
                          />
                        ) : row.diferencia === 0 ? (
                          <Chip
                            size="small"
                            label={`En el límite (0 ${row.unidad})`}
                            sx={{
                              backgroundColor: '#FFF3E0',
                              color: '#E65100',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              borderRadius: '8px',
                              border: '1px solid #FFE0B2',
                            }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<TrendingUpIcon sx={{ '&&': { color: '#2E7D32', fontSize: 16 } }} />}
                            label={`+${row.diferencia} ${row.unidad} sobre mín.`}
                            sx={{
                              backgroundColor: '#E8F5E9',
                              color: '#2E7D32',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              borderRadius: '8px',
                              border: '1px solid #C8E6C9',
                              px: 0.5,
                            }}
                          />
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={row.estado.toUpperCase()}
                          size="small"
                          sx={{
                            backgroundColor: isSinStock
                              ? '#FFCDD2'
                              : isCritico
                              ? '#FFEBEE'
                              : isAtencion
                              ? '#FFF3E0'
                              : '#E8F5E9',
                            color: isSinStock
                              ? '#B71C1C'
                              : isCritico
                              ? '#C62828'
                              : isAtencion
                              ? '#E65100'
                              : '#2E7D32',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            borderRadius: '6px',
                            border: isSinStock ? '1px solid #EF9A9A' : 'none',
                          }}
                        />
                      </TableCell>

                      {/* Operación de Stock */}
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Inventory2OutlinedIcon fontSize="small" />}
                          onClick={() => handleOpenStockDialog(row)}
                          sx={{
                            borderRadius: '8px',
                            borderColor: '#C8B2A1',
                            color: '#4A3728',
                            backgroundColor: '#FAF7F4',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            py: 0.4,
                            px: 1.2,
                            '&:hover': {
                              borderColor: '#4A3728',
                              backgroundColor: '#EFEBE6',
                            },
                          }}
                        >
                          Ajustar Stock
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

      {/* Modal de Configuración del Bot de Telegram (Exclusivo Dueño) */}
      <TelegramConfigModal
        open={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        currentUser={currentUser}
        onConfigUpdated={(cfg) => {
          setTelegramConfig(cfg);
          if (cfg?.telegram_chat_id) {
            setSnackbar({
              open: true,
              message: `¡Bot de Telegram vinculado exitosamente! (Chat ID: ${cfg.telegram_chat_id})`,
              severity: 'success',
            });
          }
        }}
      />

      {/* Diálogo de Confirmación para Desvincular desde el Menú del Botón */}
      <Dialog
        open={confirmUnlinkDialogOpen}
        onClose={() => setConfirmUnlinkDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
            maxWidth: 420,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#C62828', pb: 1 }}>
          ¿Desvincular Chat de Telegram?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#5C4535', lineHeight: 1.6 }}>
            Se desvinculará tu dispositivo (Chat ID: <b>••••••••••••</b>). Ya no recibirás alertas automáticas de inventario en tu celular.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmUnlinkDialogOpen(false)}
            sx={{ color: '#78665B', textTransform: 'none', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setConfirmUnlinkDialogOpen(false);
              try {
                await telegramDuenoService.desvincular(duenoId);
                setTelegramConfig(null);
                setSnackbar({
                  open: true,
                  message: 'Chat de Telegram desvinculado exitosamente.',
                  severity: 'info',
                });
              } catch (err) {
                setSnackbar({
                  open: true,
                  message: err.message || 'Error al desvincular el chat.',
                  severity: 'error',
                });
              }
            }}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
            }}
          >
            Sí, Desvincular
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para Modificar Stock del Insumo */}
      <ModificarStockDialog
        open={stockDialogOpen}
        onClose={() => {
          setStockDialogOpen(false);
          setProductoParaStock(null);
        }}
        producto={productoParaStock}
        onSuccess={handleStockSuccess}
      />

      {/* Snackbar para notificaciones de Telegram y acciones rápidas */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity || 'success'}
          sx={{ width: '100%', borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default StockInventario;

