// ─── Pantalla: Solicitudes de Reposición (Panel Dueño) ───────────────────────
// S2-T17: vista de SOLO LECTURA para que el dueño consulte las solicitudes de
// reposición generadas por los empleados de su cafetería.
//
// Esta pantalla NO procesa solicitudes ni modifica inventario: únicamente lee
// lo que el sistema ya persistió en `solicitudes_stock`.
//
// Flujo:
//   1. app.jsx define la ruta /dueno/solicitudes-reposicion y el ítem del menú.
//   2. Al entrar, se consultan las solicitudes de la cafetería autorizada
//      (currentUser.cafeteria_id).
//   3. Se muestran estados de carga, error y vacío.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';

import { solicitudesStock } from '../../service/solicitudes_stock';
import { parsearFecha, formatearHora } from '../../utils/dateUtils';

/**
 * Apariencia por estado. Si la base trae un estado no contemplado, se muestra
 * el texto tal cual con el estilo neutro.
 */
const ESTADOS = {
  pendiente: { label: 'Pendiente', color: '#8A5A00', bg: '#FFF4D6' },
  aprobada: { label: 'Aprobada', color: '#1B5E20', bg: '#E8F5E9' },
  aprobado: { label: 'Aprobado', color: '#1B5E20', bg: '#E8F5E9' },
  rechazada: { label: 'Rechazada', color: '#B71C1C', bg: '#FDEBEA' },
  rechazado: { label: 'Rechazado', color: '#B71C1C', bg: '#FDEBEA' },
  completada: { label: 'Completada', color: '#1B5E20', bg: '#E8F5E9' },
  entregada: { label: 'Entregada', color: '#1B5E20', bg: '#E8F5E9' },
  cancelada: { label: 'Cancelada', color: '#5F5F5F', bg: '#EEEEEE' },
};

const ESTADO_NEUTRO = { color: '#4A3B32', bg: '#F2ECE7' };

const formatearFecha = (valor) => {
  const fecha = parsearFecha(valor);
  if (!fecha) return '—';
  const dia = fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${dia} ${formatearHora(fecha)}`;
};

const nombreProducto = (solicitud) => {
  const nombre =
    typeof solicitud?.nombre_producto === 'string'
      ? solicitud.nombre_producto.trim()
      : '';
  if (nombre) return nombre;
  return solicitud?.producto_id != null
    ? `Producto #${solicitud.producto_id}`
    : '—';
};

const cantidadSolicitada = (solicitud) => {
  const cantidad = Number(solicitud?.cantidad_solicitada);
  return Number.isFinite(cantidad) ? cantidad : null;
};

function SolicitudesReposicion({ currentUser }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actualizadoEn, setActualizadoEn] = useState(null);

  // Cafetería autorizada del dueño: es la única que puede consultar.
  const cafeteriaId =
    currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? null;

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
      setSolicitudes([]);
      setError(
        'Tu usuario no tiene una cafetería autorizada asociada. No es posible consultar solicitudes de reposición.'
      );
      setLoading(false);
      return;
    }

    try {
      const datos = await solicitudesStock.listarPorCafeteria(cafeteriaId);
      setSolicitudes(Array.isArray(datos) ? datos : []);
      setActualizadoEn(new Date());
    } catch (err) {
      console.error('Error cargando solicitudes de reposición:', err);
      setSolicitudes([]);
      setError(
        err.message || 'No se pudieron cargar las solicitudes de reposición.'
      );
    } finally {
      setLoading(false);
    }
  }, [cafeteriaId]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const resumen = useMemo(() => {
    const total = solicitudes.length;
    const pendientes = solicitudes.filter(
      (s) => String(s.estado || '').trim().toLowerCase() === 'pendiente'
    ).length;
    return { total, pendientes };
  }, [solicitudes]);

  return (
    <Box>
      {/* Barra de consulta: solo lectura, sin acciones sobre las solicitudes */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          mb: 2,
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={`${resumen.total} solicitud${resumen.total === 1 ? '' : 'es'}`}
            size="small"
            sx={{ backgroundColor: '#F2ECE7', color: '#4A3B32', fontWeight: 700 }}
          />
          <Chip
            label={`${resumen.pendientes} pendiente${resumen.pendientes === 1 ? '' : 's'}`}
            size="small"
            sx={{
              backgroundColor: ESTADOS.pendiente.bg,
              color: ESTADOS.pendiente.color,
              fontWeight: 700,
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {actualizadoEn && (
            <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
              Actualizado {formatearHora(actualizadoEn)}
            </Typography>
          )}
          <Tooltip title="Actualizar consulta">
            <span>
              <IconButton
                onClick={cargarSolicitudes}
                disabled={loading}
                size="small"
                aria-label="Actualizar solicitudes de reposición"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={cargarSolicitudes}
              aria-label="Reintentar consulta"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? null : solicitudes.length === 0 ? (
        <Paper
          elevation={3}
          sx={{ borderRadius: 3, p: 4, textAlign: 'center', color: '#8C7A6F' }}
        >
          <AssignmentOutlinedIcon sx={{ fontSize: 44, mb: 1 }} />
          <Typography fontWeight={700}>
            Aún no hay solicitudes de reposición.
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Las solicitudes que generen los empleados de tu cafetería
            aparecerán aquí.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F2ECE7' }}>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>
                  Producto
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>
                  Cantidad solicitada
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>
                  Fecha
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>
                  Estado
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {solicitudes.map((solicitud) => {
                const estadoRaw =
                  typeof solicitud.estado === 'string'
                    ? solicitud.estado.trim()
                    : '';
                const estadoInfo =
                  ESTADOS[estadoRaw.toLowerCase()] || ESTADO_NEUTRO;
                const cantidad = cantidadSolicitada(solicitud);

                return (
                  <TableRow key={solicitud.id ?? `${solicitud.producto_id}-${solicitud.fecha_solicitud}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {nombreProducto(solicitud)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {cantidad !== null ? `${cantidad} un.` : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatearFecha(solicitud.fecha_solicitud)}
                    </TableCell>
                    <TableCell>
                      {estadoRaw ? (
                        <Chip
                          label={estadoInfo.label || estadoRaw}
                          size="small"
                          sx={{
                            backgroundColor: estadoInfo.bg,
                            color: estadoInfo.color,
                            fontWeight: 800,
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: '#8C7A6F' }}>
                          Sin estado
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default SolicitudesReposicion;
