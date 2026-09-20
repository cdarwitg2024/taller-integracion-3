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
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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
        const minimo = Number(p.stock_minimo ?? p.minimo ?? 0);
        const diferencia = actual - minimo;

        let estado = 'Óptimo';
        if (actual <= minimo) {
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

  const criticosCount = items.filter((i) => i.estado === 'Crítico').length;
  const atencionCount = items.filter((i) => i.estado === 'Atención').length;
  const optimosCount = items.filter((i) => i.estado === 'Óptimo').length;

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Insumo,Categoria,Stock Disponible,Minimo Requerido,Balance vs Minimo,Unidad,Estado\n' +
      items
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

      {/* Letreros de alerta condicionales: Sólo aparecen si existen advertencias reales */}
      {(criticosCount > 0 || atencionCount > 0) && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {criticosCount > 0 && (
            <Grid item xs={12} sm={atencionCount > 0 ? 6 : 12}>
              <Card
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1px solid #FFCDD2',
                  bgcolor: '#FFEBEE',
                }}
              >
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Stack direction="row" spacing={1.8} alignItems="center">
                    <ErrorOutlinedIcon sx={{ color: '#C62828', fontSize: 36 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#B71C1C' }}>
                        {criticosCount} Insumo{criticosCount > 1 ? 's' : ''} Crítico{criticosCount > 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#C62828', display: 'block' }}>
                        Stock igual o menor al mínimo requerido. Requiere reposición.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          {atencionCount > 0 && (
            <Grid item xs={12} sm={criticosCount > 0 ? 6 : 12}>
              <Card
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1px solid #FFE0B2',
                  bgcolor: '#FFF3E0',
                }}
              >
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Stack direction="row" spacing={1.8} alignItems="center">
                    <WarningAmberIcon sx={{ color: '#E65100', fontSize: 36 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#E65100' }}>
                        {atencionCount} Insumo{atencionCount > 1 ? 's' : ''} en Advertencia
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#BF360C', display: 'block' }}>
                        Próximos a cruzar el umbral mínimo de stock.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

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
                  const isCritico = row.estado === 'Crítico';
                  const isAtencion = row.estado === 'Atención';

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        backgroundColor: isCritico ? 'rgba(255, 235, 238, 0.3)' : 'inherit',
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
                          color: isCritico ? '#C62828' : '#3E2D22',
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
                            icon={<TrendingDownIcon sx={{ '&&': { color: '#C62828', fontSize: 16 } }} />}
                            label={`Faltan ${Math.abs(row.diferencia)} ${row.unidad}`}
                            sx={{
                              backgroundColor: '#FFEBEE',
                              color: '#C62828',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              borderRadius: '8px',
                              border: '1px solid #FFCDD2',
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
                            backgroundColor: isCritico
                              ? '#FFEBEE'
                              : isAtencion
                              ? '#FFF3E0'
                              : '#E8F5E9',
                            color: isCritico
                              ? '#C62828'
                              : isAtencion
                              ? '#E65100'
                              : '#2E7D32',
                            fontWeight: 800,
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
