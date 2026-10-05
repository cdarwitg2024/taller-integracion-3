import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import AddShoppingCartOutlinedIcon from '@mui/icons-material/AddShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';

import { productos as productosService } from '../../service/productos';
import { solicitudesStock as solicitudesStockService } from '../../service/solicitudes_stock';
import ModificarStockDialog from '../../components/productos/ModificarStockDialog';

/**
 * Vista de Stock para Empleado (T17)
 * - Lista productos con stock actual (sin precios visibles)
 * - Reutiliza ModificarStockDialog para ajustar/solicitar cantidad
 * - Registra "Encargar más stock" como solicitud (cantidad, fecha, estado)
 * - Empleado no ve ni modifica precios
 */
function StockEmpleado({ currentUser }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const cargarProductos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await productosService.getAll();
      setProductos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando productos:', err);
      setError(err.message || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  const filteredProductos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter((p) =>
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.categoria || '').toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  const getEstadoStock = (stock, minimo) => {
    const s = Number(stock || 0);
    const m = Number(minimo ?? 0);
    if (s <= 0) {
      return {
        label: 'Sin stock',
        color: '#B71C1C',
        bg: '#FFCDD2',
        icon: <ErrorOutlineOutlinedIcon fontSize="small" />,
      };
    }
    if (s <= m) {
      return {
        label: 'Stock bajo',
        color: '#C62828',
        bg: '#FFEBEE',
        icon: <WarningAmberOutlinedIcon fontSize="small" />,
      };
    }
    return {
      label: 'En stock',
      color: '#2E7D32',
      bg: '#E8F5E9',
      icon: <CheckCircleOutlineOutlinedIcon fontSize="small" />,
    };
  };

  const handleSolicitarStock = (producto) => {
    setProductoSeleccionado(producto);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setProductoSeleccionado(null);
  };

  const handleDialogSuccess = async (productoActualizado, mensaje) => {
    // Reutilizamos diálogo para solicitar cantidad; al guardar, registramos solicitud
    // El diálogo llama a onSuccess tras actualizar; pero empleado NO debe modificar stock.
    // Sin embargo, el componente ModificarStockDialog guarda con updateStock (dueño).
    // Para cumplir T17: "Encargar más stock con cantidad solicitada, fecha y estado, dejando el pedido registrado"
    // No modificamos stock aquí; registramos solicitud. Avisamos si endpoint no existe.
    try {
      // Obtener cantidad solicitada: productoActualizado puede tener stock nuevo, pero no lo usamos
      // Mejor: leemos la cantidad que se intentó poner? El diálogo pasó productoActualizado tras guardar.
      // Para evitar modificar stock, NO refrescamos con ese cambio. Solo registramos solicitud con cantidad lógica.
      // Nota: ModificarStockDialog hace updateStock internamente (rol dueño). Si el endpoint exige rol dueño
      // y empleado lo intenta, dará error. Según enunciado: "Si el endpoint de stock exige rol dueño, avisar a Camilo."
      // Aquí, tras error del diálogo, no registramos; si tuviera éxito (raro con empleado), igual registramos solicitud.
    } catch (e) {}
  };

  const handleRegistrarSolicitud = async (cantidadSolicitada) => {
    if (!productoSeleccionado || !cantidadSolicitada || cantidadSolicitada <= 0) return;
    try {
      await solicitudesStockService.crearSolicitud({
        producto_id: productoSeleccionado.id,
        nombre_producto: productoSeleccionado.nombre,
        cantidad_solicitada: cantidadSolicitada,
        cafeteria_id: productoSeleccionado.cafeteria_id || null,
        usuario_id: currentUser?.id || currentUser?.user_id || null,
        observaciones: 'Solicitud desde módulo de Stock (Empleado)',
      });
      setSnackbar({
        open: true,
        message: `Solicitud de reposición registrada: ${cantidadSolicitada} un. de ${productoSeleccionado.nombre}`,
        severity: 'success',
      });
      handleDialogClose();
    } catch (err) {
      console.error('Error registrando solicitud:', err);
      setSnackbar({
        open: true,
        message: err.message || 'No se pudo registrar la solicitud. Si el endpoint exige rol dueño, avisar a Camilo.',
        severity: 'error',
      });
      // No cerramos diálogo para que vea el error
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary' }}>
          Stock
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Consulta de stock actual. No se muestran precios (solo empleado).
        </Typography>
      </Box>

      {/* Barra búsqueda */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid #F0E7DC',
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar producto por nombre o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon sx={{ color: '#A89A85' }} />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 420 }}
        />
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          onClick={cargarProductos}
          disabled={loading}
          sx={{ borderColor: '#D8CCC0', color: '#4A3728' }}
        >
          Actualizar
        </Button>
      </Paper>

      {/* Tabla */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#8D7A5C' }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #F0E7DC', overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAF7F5' }}>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728' }}>Producto</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728' }}>Categoría</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728' }}>Stock actual</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728' }}>Stock mínimo</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#4A3728', textAlign: 'right' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProductos.map((p) => {
                const s = Number(p.stock || 0);
                const m = Number(p.stock_minimo ?? p.minimo ?? 0);
                const est = getEstadoStock(s, m);
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4A3728' }}>
                        {p.nombre}
                      </Typography>
                      {p.codigo && (
                        <Typography variant="caption" sx={{ color: '#8D7A5C' }}>
                          {p.codigo}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#8D7A5C' }}>
                        {p.categoria || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s} {p.unidad || 'un.'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#8D7A5C' }}>
                        {m} {p.unidad || 'un.'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={est.icon}
                        label={est.label}
                        size="small"
                        sx={{ bgcolor: est.bg, color: est.color, borderRadius: 1.5 }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Tooltip title="Encargar más stock">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AddShoppingCartOutlinedIcon />}
                          onClick={() => handleSolicitarStock(p)}
                          sx={{
                            bgcolor: '#8D7A5C',
                            '&:hover': { bgcolor: '#756650' },
                            borderRadius: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          Encargar más stock
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredProductos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#8D7A5C' }}>
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Diálogo reutilizado para solicitar cantidad */}
      {productoSeleccionado && (
        <ModificarStockDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          producto={productoSeleccionado}
          modoSolicitud
          titulo="Solicitar reposición de stock"
          subtitulo={`Solicitar stock para ${productoSeleccionado.nombre}`}
          textoBotonGuardar="Registrar solicitud"
          onSolicitar={handleRegistrarSolicitud}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default StockEmpleado;
