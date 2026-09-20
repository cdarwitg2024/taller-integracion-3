import { useState, useEffect } from 'react';
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
} from '@mui/material';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';

import { productos as productosService } from '../service/productos';
import { alertasStock as alertasService } from '../service/alertas_stock';

function StockInventario() {
  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsData, alertasData] = await Promise.all([
        productosService.getAll(),
        alertasService.getNoLeidas(),
      ]);

      const formatted = prodsData.map((p) => {
        const actual = Number(p.stock || 0);
        const minimo = Number(p.stock_minimo ?? p.minimo ?? 0) || 1;
        let estado = 'Óptimo';
        if (actual <= minimo) {
          estado = 'Crítico';
        } else if (actual <= minimo * 1.5) {
          estado = 'Atención';
        }

        return {
          id: p.id,
          insumo: p.nombre,
          actual,
          minimo,
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

  const criticosCount = items.filter((i) => i.estado === 'Crítico').length;

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Insumo,Stock Disponible,Minimo Requerido,Unidad,Estado\n' +
      items.map((e) => `"${e.insumo}",${e.actual},${e.minimo},"${e.unidad}","${e.estado}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_coffeefaster_${new Date().toISOString().slice(0, 10)}.csv`);
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
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
        >
          Stock e Inventario
        </Typography>

        <Stack direction="row" spacing={1.5}>
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

      {/* Alerta rápida si hay ítems críticos */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card elevation={0} sx={{ p: 1, borderRadius: '14px', border: '1px solid #FFCDD2', bgcolor: '#FFEBEE' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <WarningAmberIcon sx={{ color: '#C62828', fontSize: 34 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#B71C1C' }}>
                    {criticosCount} Insumos bajo el nivel mínimo
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#C62828' }}>
                    {alertas.length > 0
                      ? `${alertas.length} alertas registradas en el sistema.`
                      : 'Se recomienda realizar una orden de reabastecimiento pronto.'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card elevation={0} sx={{ p: 1, borderRadius: '14px', border: '1px solid #C8E6C9', bgcolor: '#E8F5E9' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <CheckCircleOutlinedIcon sx={{ color: '#2E7D32', fontSize: 34 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#1B5E20' }}>
                    Inventario general sincronizado
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2E7D32' }}>
                    {lastUpdated ? `Última consulta realizada a las ${lastUpdated} hrs.` : 'Conectado a base de datos.'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2, bgcolor: '#FAF2EA', '& .MuiLinearProgress-bar': { bgcolor: '#C86237' } }} />}

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
                <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5, minWidth: 150 }}>
                  NIVEL
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.75rem', py: 1.5 }}>
                  ESTADO
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {items.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                    No hay insumos registrados en inventario.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => {
                  const ratio = Math.min(100, Math.round((row.actual / (row.minimo || 1)) * 100));
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderColor: '#F2ECE6',
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: '#3E2D22', fontSize: '0.85rem' }}>
                        {row.insumo}
                      </TableCell>

                      <TableCell align="center" sx={{ fontWeight: 700, color: '#3E2D22', fontSize: '0.85rem' }}>
                        {row.actual} {row.unidad}
                      </TableCell>

                      <TableCell align="center" sx={{ color: '#78665B', fontSize: '0.85rem' }}>
                        {row.minimo} {row.unidad}
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, ratio)}
                            sx={{
                              flexGrow: 1,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: '#EAE2D8',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor:
                                  row.estado === 'Crítico'
                                    ? '#C62828'
                                    : row.estado === 'Atención'
                                    ? '#E65100'
                                    : '#2E7D32',
                              },
                            }}
                          />
                          <Typography variant="caption" sx={{ color: '#78665B', fontWeight: 600, minWidth: 32 }}>
                            {ratio}%
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={row.estado.toUpperCase()}
                          size="small"
                          sx={{
                            backgroundColor:
                              row.estado === 'Crítico'
                                ? '#FFEBEE'
                                : row.estado === 'Atención'
                                ? '#FFF3E0'
                                : '#E8F5E9',
                            color:
                              row.estado === 'Crítico'
                                ? '#C62828'
                                : row.estado === 'Atención'
                                ? '#E65100'
                                : '#2E7D32',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default StockInventario;
