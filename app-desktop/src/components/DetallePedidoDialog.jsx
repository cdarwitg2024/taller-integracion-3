import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

import EstadoChip from './EstadoChip';

function formatoHM(fecha) {
  const h24 = fecha.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')} ${ampm}`;
}

function getHoraRetiro(pedido) {
  if (pedido.hora_retiro) return pedido.hora_retiro;
  if (pedido.creado_en) {
    const fecha = new Date(pedido.creado_en);
    if (!Number.isNaN(fecha.getTime())) {
      return formatoHM(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function DetallePedidoDialog({ pedido, onClose, onChangeEstado }) {
  return (
    <Dialog
      open={Boolean(pedido)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      {pedido && (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight={800}>
                Detalle de Comanda #{pedido.id}
              </Typography>
              <IconButton onClick={onClose} sx={{ minHeight: 48, minWidth: 48 }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <EstadoChip estado={pedido.estado} />
              <Typography fontWeight={800} sx={{ color: '#4A3B32' }}>
                🕐 Hora de retiro: {getHoraRetiro(pedido)}
              </Typography>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Ítems de Preparación:
            </Typography>
            <List disablePadding>
              {pedido.productos?.map((prod, idx) => (
                <ListItem key={idx} disableGutters>
                  <ListItemText primary={`${prod.nombre} × ${prod.cantidad}`} />
                </ListItem>
              ))}
            </List>
          </DialogContent>

          <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Button startIcon={<PrintIcon />} variant="outlined" sx={{ minHeight: 48 }}>
              Imprimir Comanda
            </Button>

            <Stack direction="row" spacing={1}>
              {pedido.estado === 'pendiente' && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => onChangeEstado(pedido.id, 'preparando')}
                  sx={{ minHeight: 48 }}
                >
                  Iniciar Preparación
                </Button>
              )}
              {pedido.estado === 'preparando' && (
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<CheckIcon />}
                  onClick={() => onChangeEstado(pedido.id, 'listo')}
                  sx={{ minHeight: 48 }}
                >
                  Marcar Como Listo
                </Button>
              )}
              {pedido.estado === 'listo' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<LocalShippingIcon />}
                  onClick={() => onChangeEstado(pedido.id, 'entregado')}
                  sx={{ minHeight: 48 }}
                >
                  Confirmar Entrega
                </Button>
              )}
            </Stack>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

export default DetallePedidoDialog;