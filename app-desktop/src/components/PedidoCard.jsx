import {
  Button,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

import EstadoChip from './EstadoChip';

const colorBordePorEstado = {
  pendiente: '#d32f2f',
  preparando: '#ed6c02',
  listo: '#0288d1',
  entregado: '#2e7d32',
};

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  return (
    <Card
      elevation={3}
      sx={{
        borderRadius: 3,
        cursor: 'pointer',
        borderTop: `6px solid ${colorBordePorEstado[pedido.estado] || '#0288d1'}`,
        '&:active': { transform: 'scale(0.99)', boxShadow: 6 },
        '&:hover': { boxShadow: 6 },
      }}
      onClick={() => onOpen(pedido)}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            #{pedido.id}
          </Typography>
          <EstadoChip estado={pedido.estado} />
        </Stack>

        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {pedido.cliente}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          ⏰ {pedido.hora} - {pedido.ubicacion}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          PRODUCTOS ({pedido.productos?.length || 0}):
        </Typography>
        <List disablePadding sx={{ my: 1 }}>
          {pedido.productos?.slice(0, 2).map((item, idx) => (
            <ListItem key={idx} disableGutters sx={{ py: 0.2 }}>
              <ListItemText
                primary={`${item.cantidad}x ${item.nombre}`}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
          {(pedido.productos?.length || 0) > 2 && (
            <Typography variant="caption" color="primary">
              +{pedido.productos.length - 2} más...
            </Typography>
          )}
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight={800} color="success.main">
            ${pedido.total?.toLocaleString('es-CL')}
          </Typography>

          {pedido.estado === 'pendiente' && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<PlayArrowIcon />}
              onClick={(e) => onChangeEstado(pedido.id, 'preparando', e)}
              sx={{ minHeight: 48 }}
            >
              Preparar
            </Button>
          )}
          {pedido.estado === 'preparando' && (
            <Button
              variant="contained"
              color="info"
              startIcon={<CheckIcon />}
              onClick={(e) => onChangeEstado(pedido.id, 'listo', e)}
              sx={{ minHeight: 48 }}
            >
              Marcar Listo
            </Button>
          )}
          {pedido.estado === 'listo' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<LocalShippingIcon />}
              onClick={(e) => onChangeEstado(pedido.id, 'entregado', e)}
              sx={{ minHeight: 48 }}
            >
              Entregar
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default PedidoCard;