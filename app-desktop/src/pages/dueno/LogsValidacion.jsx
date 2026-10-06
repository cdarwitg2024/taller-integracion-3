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
} from '@mui/material';

import logsValidacionQr from '../../service/logs_validacion_qr';
import { formatearHora } from '../../utils/dateUtils';

const resultadoColor = {
  entregado: '#2E7D32',
  rechazado: '#C62828',
  error: '#B71C1C',
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary' }}>
          Logs de Validación QR/Token
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Registro de entregas y rechazos verificados por QR o Token. Solo visible para el Dueño.
        </Typography>
      </Box>

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
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Token</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Resultado</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#4A3B32' }}>Detalle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const usuario =
                  (Array.isArray(log.usuarios) ? log.usuarios[0] : log.usuarios)?.nombre ||
                  (Array.isArray(log.usuarios) ? log.usuarios[0] : log.usuarios)?.apellido ||
                  '—';
                return (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {log.validado_en ? formatearHora(new Date(log.validado_en)) : '—'}
                    </TableCell>
                    <TableCell>#{log.pedido_id ?? log.pedidos?.id ?? '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{log.qr_token || '—'}</TableCell>
                    <TableCell>{usuario}</TableCell>
                    <TableCell>
                      <Chip
                        label={(log.resultado || '—').toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor:
                            log.resultado === 'entregado' ? '#E8F5E9' : '#FDEBEA',
                          color: resultadoColor[log.resultado] || '#4A3B32',
                          fontWeight: 800,
                        }}
                      />
                    </TableCell>
                    <TableCell>{log.detalle || '—'}</TableCell>
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