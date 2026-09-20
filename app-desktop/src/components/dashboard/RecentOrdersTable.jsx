import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';

function RecentOrdersTable({ pedidos }) {
  const getEstadoChip = (estado) => {
    switch (estado) {
      case 'pendiente':
        return (
          <Chip
            label="PENDIENTE"
            size="small"
            sx={{
              backgroundColor: '#FFEBEE',
              color: '#C62828',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          />
        );
      case 'preparando':
        return (
          <Chip
            label="EN PREPARACIÓN"
            size="small"
            sx={{
              backgroundColor: '#FFF3E0',
              color: '#E65100',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          />
        );
      case 'listo':
        return (
          <Chip
            label="LISTO"
            size="small"
            sx={{
              backgroundColor: '#E0F2F1',
              color: '#00695C',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          />
        );
      case 'entregado':
        return (
          <Chip
            label="ENTREGADO"
            size="small"
            sx={{
              backgroundColor: '#E8F5E9',
              color: '#2E7D32',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          />
        );
      default:
        return (
          <Chip
            label={estado?.toUpperCase()}
            size="small"
            sx={{
              backgroundColor: '#F5F5F5',
              color: '#616161',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          />
        );
    }
  };

  const displayPedidos = pedidos && pedidos.length > 0 ? pedidos.slice(0, 6) : [];

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '16px',
        border: '1px solid #EFEAE6',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#4A3728', fontSize: '1.1rem' }}>
          Últimos Pedidos Registrados
        </Typography>
        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
          Actividad reciente en el punto de venta
        </Typography>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5EDE4' }}>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                CÓDIGO / ID
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                CLIENTE
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                UBICACIÓN / SEDE
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                HORA
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                TOTAL
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#5C4535', fontSize: '0.78rem', py: 1.5 }}>
                ESTADO
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {displayPedidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#8C7A6F' }}>
                  No hay pedidos registrados recientemente.
                </TableCell>
              </TableRow>
            ) : (
              displayPedidos.map((p) => {
                const userObj = p.usuarios || p.USUARIOS;
                const clienteNombre =
                  p.cliente ||
                  (userObj ? `${userObj.nombre || ''} ${userObj.apellido || ''}`.trim() : 'Cliente General');
                const cafeObj = p.cafeterias || p.CAFETERIAS;
                const ubicacionNombre =
                  p.ubicacion ||
                  (cafeObj?.nombre ? cafeObj.nombre : 'Campus Central');
                const horaFormat = p.hora || (p.creado_en ? new Date(p.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');

                return (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      borderColor: '#F0EAE4',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, color: '#4A3728', fontSize: '0.85rem' }}>
                      #{p.codigo_retiro_diario || p.id}
                    </TableCell>
                    <TableCell sx={{ color: '#3B291D', fontSize: '0.85rem', fontWeight: 500 }}>
                      {clienteNombre}
                    </TableCell>
                    <TableCell sx={{ color: '#78665B', fontSize: '0.82rem' }}>
                      {ubicacionNombre}
                    </TableCell>
                    <TableCell sx={{ color: '#78665B', fontSize: '0.82rem' }}>
                      {horaFormat}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#3B291D', fontSize: '0.85rem' }}>
                      ${(p.total || 0).toLocaleString('es-CL')}
                    </TableCell>
                    <TableCell>
                      {getEstadoChip(p.estado)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default RecentOrdersTable;
