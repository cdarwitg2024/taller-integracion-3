import {
  Alert, Box, Chip, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { estadoConvenio, formatearFecha, formatearTasa } from '../../utils/condicionesCampana';

const moneda = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function HistorialConvenio({ campanas = [], movimientos = [], errorMovimientos = '' }) {
  const campanasPorId = new Map(campanas.map(campana => [String(campana.id), campana]));

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #E9E1D9', bgcolor: '#FFFFFF' }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: '#2C1810' }}>
          Historial de convenios
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Consulta las versiones, su estado y el periodo durante el que aplican.
        </Typography>

        {campanas.length ? (
          <TableContainer>
            <Table size="small" aria-label="Historial de convenios">
              <TableHead>
                <TableRow>
                  <TableCell>Convenio</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Versión</TableCell>
                  <TableCell align="right">Comisión</TableCell>
                  <TableCell>Vigencia</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campanas.map(campana => {
                  const estado = estadoConvenio(campana);
                  return (
                    <TableRow key={campana.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{campana.nombre || 'Convenio'}</Typography>
                        {campana.descripcion && <Typography variant="caption" color="text.secondary">{campana.descripcion}</Typography>}
                      </TableCell>
                      <TableCell><Chip size="small" label={estado.label} color={estado.color} /></TableCell>
                      <TableCell>{campana.version_condiciones || '—'}</TableCell>
                      <TableCell align="right">{formatearTasa(campana.tasa_comision)}%</TableCell>
                      <TableCell>
                        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                          {formatearFecha(campana.vigencia_desde)} – {formatearFecha(campana.vigencia_hasta)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">Todavía no hay convenios registrados para esta cafetería.</Alert>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #E9E1D9', bgcolor: '#FFFFFF' }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: '#2C1810' }}>
          Comisiones históricas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Cada movimiento conserva la tasa y el importe registrados; los cambios futuros del convenio no los recalculan.
        </Typography>

        {errorMovimientos ? <Alert severity="warning">{errorMovimientos}</Alert> : movimientos.length ? (
          <TableContainer>
            <Table size="small" aria-label="Comisiones históricas del convenio">
              <TableHead>
                <TableRow>
                  <TableCell>Pedido</TableCell>
                  <TableCell>Convenio</TableCell>
                  <TableCell>Movimiento</TableCell>
                  <TableCell align="right">Tasa aplicada</TableCell>
                  <TableCell align="right">Importe</TableCell>
                  <TableCell>Registrado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientos.map(movimiento => {
                  const campanaId = movimiento.afiliacion?.campana_id;
                  const campana = campanasPorId.get(String(campanaId));
                  return (
                    <TableRow key={movimiento.id}>
                      <TableCell>#{movimiento.pedido_id}</TableCell>
                      <TableCell>{campana?.nombre || `Convenio #${campanaId ?? '—'}`}</TableCell>
                      <TableCell>{movimiento.tipo === 'reversion' ? 'Reversión' : 'Comisión'}</TableCell>
                      <TableCell align="right">{formatearTasa(movimiento.tasa_comision)}%</TableCell>
                      <TableCell align="right">{moneda.format(Number(movimiento.monto_clp) || 0)}</TableCell>
                      <TableCell><Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatearFecha(movimiento.creado_en)}</Box></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No hay movimientos de comisión registrados para estos convenios.</Alert>
        )}
      </Paper>
    </Stack>
  );
}
