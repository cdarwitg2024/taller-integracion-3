import { useState } from 'react';
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

const mockInventario = [
  { id: 1, insumo: 'Granos Café Espresso', actual: 18, minimo: 25, unidad: 'kg', estado: 'Crítico' },
  { id: 2, insumo: 'Leche Descremada', actual: 6, minimo: 15, unidad: 'litros', estado: 'Crítico' },
  { id: 3, insumo: 'Vasos Térmicos 12oz', actual: 350, minimo: 150, unidad: 'unid', estado: 'Óptimo' },
  { id: 4, insumo: 'Vasos Térmicos 8oz', actual: 210, minimo: 100, unidad: 'unid', estado: 'Óptimo' },
  { id: 5, insumo: 'Jarabe Vainilla Monin', actual: 4, minimo: 2, unidad: 'botellas', estado: 'Óptimo' },
  { id: 6, insumo: 'Servilletas de papel', actual: 45, minimo: 50, unidad: 'paquetes', estado: 'Atención' },
];

function StockInventario() {
  const [items] = useState(mockInventario);

  const criticosCount = items.filter((i) => i.estado === 'Crítico').length;

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

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          sx={{
            ml: 'auto',
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
                    Se recomienda realizar una orden de reabastecimiento pronto.
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
                    Inventario general actualizado
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2E7D32' }}>
                    Último recuento registrado hace 2 horas.
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
              {items.map((row) => {
                const ratio = Math.min(100, Math.round((row.actual / row.minimo) * 100));
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
                              backgroundColor: row.estado === 'Crítico' ? '#C62828' : row.estado === 'Atención' ? '#E65100' : '#2E7D32',
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
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default StockInventario;
