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
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body1"><strong>Cliente:</strong> {pedido.cliente}</Typography>
              <Typography variant="body2"><strong>Lugar de Entrega:</strong> {pedido.ubicacion}</Typography>
              <Typography variant="body2"><strong>Código QR:</strong> <code>{pedido.qr_token}</code></Typography>
              <Typography variant="body2"><strong>Estado Actual:</strong> <EstadoChip estado={pedido.estado} /></Typography>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Ítems del Pedido:
            </Typography>
            <List disablePadding>
              {pedido.productos?.map((prod, idx) => (
                <ListItem key={idx} disableGutters>
                  <ListItemText
                    primary={`${prod.cantidad}x ${prod.nombre}`}
                    secondary={prod.detalle}
                  />
                  <Typography fontWeight={700}>
                    ${(prod.precio * prod.cantidad).toLocaleString('es-CL')}
                  </Typography>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={800}>Total a Pagar:</Typography>
              <Typography variant="h5" fontWeight={800} color="success.main">
                ${pedido.total?.toLocaleString('es-CL')}
              </Typography>
            </Stack>
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