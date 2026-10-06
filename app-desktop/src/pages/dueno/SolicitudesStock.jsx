import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  MenuItem,
  Snackbar,
  Alert,
  TextField,
  FormControl,
  Select,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import { solicitudesStock as solicitudesStockService } from '../../service/solicitudes_stock';

const COLOR_ESTADO = {
  pendiente: { bg: '#FFF3E0', fg: '#E65100', label: 'PENDIENTE' },
  aprobado: { bg: '#E8F5E9', fg: '#2E7D32', label: 'APROBADO' },
  rechazado: { bg: '#FFEBEE', fg: '#C62828', label: 'RECHAZADO' },
};

const formatoFecha = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * Solicitudes de reposicion de stock (T17) - vista del DUENO.
 *
 * El empleado las crea desde /empleado/stock; aqui el dueno las aprueba o
 * rechaza. Al aprobar, la cantidad se suma sola al stock del producto.
 */
function SolicitudesStock({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [estadoFiltro, setEstadoFiltro] = useState('pendiente');
  const [searchTerm, setSearchTerm] = useState('');

  const usuarioId = currentUser?.id || currentUser?.user_id || null;

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await solicitudesStockService.listarPorEstado(estadoFiltro);
      setItems(data);
      setError(null);
      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    } catch (err) {
      console.error('Error cargando solicitudes de stock:', err);
      setError(err.message || 'No se pudieron cargar las solicitudes.');
      setItems([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro]);

  const handleResponder = async (solicitud, accion) => {
    setProcesandoId(solicitud.id);
    try {
      if (accion === 'aprobar') {
        await solicitudesStockService.aprobarSolicitud(solicitud.id, usuarioId);
        setSnackbar({
          open: true,
          message: `Solicitud aprobada. Se sumo ${solicitud.cantidad_solicitada} u. a "${solicitud.nombre_producto || 'el producto'}".`,
          severity: 'success',
        });
      } else {
        await solicitudesStockService.rechazarSolicitud(solicitud.id, usuarioId);
        setSnackbar({
          open: true,
          message: `Solicitud rechazada: "${solicitud.nombre_producto || 'el producto'}".`,
          severity: 'info',
        });
      }
      await loadData(false);
    } catch (err) {
      console.error(`Error al ${accion} la solicitud:`, err);
      setSnackbar({
        open: true,
        message: err.message || `No se pudo ${accion} la solicitud.`,
        severity: 'error',
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      const nombre = (s.nombre_producto || '').toLowerCase();
      const obs = (s.observaciones || '').toLowerCase();
      return nombre.includes(term) || obs.includes(term);
    });
  }, [items, searchTerm]);

  const pendientesCount = items.filter((s) => s.estado === 'pendiente').length;

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{ color: 'text.primary', letterSpacing: '-0.5px' }}
          >
            Solicitudes de Reposición
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Aprueba o rechaza lo que pide el personal de cocina
            {lastUpdated ? ` • Sincronizado: ${lastUpdated}` : ''}
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
            px: 2,
            py: 1,
            fontWeight: 600,
            '&:hover': { borderColor: '#4A3728', backgroundColor: '#FAF7F4' },
          }}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          variant="filled"
          action={
            <Button color="inherit" size="small" onClick={() => loadData(true)}>
              Reintentar
            </Button>
          }
          sx={{
            mb: 3,
            borderRadius: '14px',
            fontWeight: 700,
            backgroundColor: '#C62828',
          }}
        >
          {error}. Verifica que la tabla `solicitudes_stock` exista en la base de datos.
        </Alert>
      )}

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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <Select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              sx={{ borderRadius: '12px', backgroundColor: '#FAF7F5', fontSize: '0.85rem' }}
            >
              <MenuItem value="pendiente">
                Pendientes {estadoFiltro === 'pendiente' && pendientesCount > 0 ? `(${pendientesCount})` : ''}
              </MenuItem>
              <MenuItem value="aprobado">Aprobadas</MenuItem>
              <MenuItem value="rechazado">Rechazadas</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por producto u observación..."
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
        </Stack>
      </Paper>

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
                  PRODUCTO
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  CANTIDAD
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  OBSERVACIONES
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  SOLICITADO
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
                    {error
                      ? 'No se pudieron cargar las solicitudes.'
                      : estadoFiltro === 'pendiente'
                      ? 'No hay solicitudes pendientes de revisar.'
                      : 'No hay solicitudes en este estado.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((s) => {
                  const colores = COLOR_ESTADO[s.estado] || COLOR_ESTADO.pendiente;
                  const enCurso = procesandoId === s.id;

                  return (
                    <TableRow
                      key={s.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 }, borderColor: '#F2ECE6' }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#3E2D22' }}>
                          {s.nombre_producto || `Producto #${s.producto_id}`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
                          #{s.id}
                        </Typography>
                      </TableCell>

                      <TableCell align="center" sx={{ fontWeight: 800, color: '#3E2D22', fontSize: '0.88rem' }}>
                        +{s.cantidad_solicitada} u.
                      </TableCell>

                      <TableCell sx={{ color: '#78665B', fontSize: '0.82rem', maxWidth: 280 }}>
                        {s.observaciones || '-'}
                      </TableCell>

                      <TableCell sx={{ color: '#78665B', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {formatoFecha(s.fecha_solicitud)}
                        {s.fecha_respuesta && (
                          <Typography variant="caption" sx={{ display: 'block', color: '#A08D80' }}>
                            Respondida: {formatoFecha(s.fecha_respuesta)}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={colores.label}
                          size="small"
                          sx={{
                            backgroundColor: colores.bg,
                            color: colores.fg,
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        {s.estado === 'pendiente' ? (
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="Aprobar y sumar al stock">
                              <span>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={enCurso}
                                  startIcon={
                                    enCurso ? undefined : <CheckCircleOutlineIcon fontSize="small" />
                                  }
                                  onClick={() => handleResponder(s, 'aprobar')}
                                  sx={{
                                    borderRadius: '8px',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    py: 0.4,
                                    px: 1.2,
                                    backgroundColor: '#2E7D32',
                                    '&:hover': { backgroundColor: '#1B5E20' },
                                  }}
                                >
                                  Aprobar
                                </Button>
                              </span>
                            </Tooltip>

                            <Tooltip title="Rechazar">
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={enCurso}
                                  startIcon={enCurso ? undefined : <CloseIcon fontSize="small" />}
                                  onClick={() => handleResponder(s, 'rechazar')}
                                  sx={{
                                    borderRadius: '8px',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    py: 0.4,
                                    px: 1.2,
                                    borderColor: '#EF9A9A',
                                    color: '#C62828',
                                    '&:hover': { borderColor: '#C62828', backgroundColor: '#FFEBEE' },
                                  }}
                                >
                                  Rechazar
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#A08D80' }}>
                            {formatoFecha(s.fecha_respuesta)}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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

export default SolicitudesStock;
