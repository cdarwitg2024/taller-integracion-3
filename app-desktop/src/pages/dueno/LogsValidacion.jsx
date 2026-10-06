import { useState, useEffect, useCallback } from 'react';
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

import logsValidacionQr from '../../service/logs_validacion_qr';
import { formatearHora } from '../../utils/dateUtils';

const resultadoColor = {
  entregado: '#2E7D32',
  aprobado: '#2E7D32',
  rechazado: '#E65100',
  error: '#C62828',
};

function LogsValidacion() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const datos = await logsValidacionQr.getAll();
      setLogs(datos || []);
    } catch (err) {
      console.error('Error cargando logs de validación:', err);
      setError(
        'Sin conexión con la base de datos Supabase. Verifique que el servicio de base de datos se encuentre iniciado.'
      );
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarLogs();
  }, [cargarLogs]);

  return (
    <Box>
<<<<<<< HEAD
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary' }}>
          Logs de Validación QR/Token
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Registro de entregas y rechazos verificados por QR o Token. Solo visible para el Dueño.
        </Typography>
      </Box>
=======
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#4A3B32' }}>
            Logs de Validación QR/Token
          </Typography>
          <Typography sx={{ color: '#8C7A6F', mt: 0.5 }}>
            Registro de entregas y rechazos verificados por QR o Token. Solo visible para el Dueño.
          </Typography>
        </Box>
        <Tooltip title="Actualizar registros">
          <IconButton
            onClick={cargarLogs}
            disabled={loading}
            sx={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              '&:hover': { backgroundColor: '#F2ECE7' },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
>>>>>>> origin/develop

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Paper elevation={3} sx={{ borderRadius: 3, p: 4, textAlign: 'center', color: '#8C7A6F' }}>
          <Typography fontWeight={700}>Aún no hay validaciones registradas.</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Los registros aparecerán aquí cuando se valide un QR o Token de entrega.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F2ECE7' }}>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Pedido</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Token / QR</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Usuario / Empleado</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Resultado</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Detalle / Motivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const userObj = Array.isArray(log.usuarios) ? log.usuarios[0] : log.usuarios;
                const nombreCompleto = userObj
                  ? `${userObj.nombre || ''} ${userObj.apellido || ''}`.trim() || userObj.nombre
                  : null;
                const usuario = nombreCompleto || (log.usuario_id ? `Usuario #${log.usuario_id}` : '—');
                const fechaRaw = log.validado_en || log.creado_en;
                const fechaStr = fechaRaw ? formatearHora(new Date(fechaRaw)) : '—';
                const tokenStr = log.qr_token_leido || log.qr_token || '—';
                const resultadoStr = String(log.resultado || '—').toLowerCase();
                const esExito = resultadoStr === 'entregado' || resultadoStr === 'aprobado';
                const detalleStr = log.motivo_rechazo || log.detalle || (esExito ? 'Entrega validada' : '—');

                return (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {fechaStr}
                    </TableCell>
                    <TableCell>#{log.pedido_id ?? log.pedidos?.id ?? '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tokenStr}
                    </TableCell>
                    <TableCell>{usuario}</TableCell>
                    <TableCell>
                      <Chip
                        label={resultadoStr.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: esExito ? '#E8F5E9' : '#FDEBEA',
                          color: resultadoColor[resultadoStr] || (esExito ? '#2E7D32' : '#C62828'),
                          fontWeight: 800,
                        }}
                      />
                    </TableCell>
                    <TableCell>{detalleStr}</TableCell>
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

export default LogsValidacion;