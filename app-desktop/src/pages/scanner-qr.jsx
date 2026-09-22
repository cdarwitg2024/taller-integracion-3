import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';

import pedidosService from '../services/pedidosService';

function ScannerQr() {
  const [inputCode, setInputCode] = useState('');
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [scanningMode, setScanningMode] = useState('manual'); // 'manual' o 'camera'

  const handleBuscarPedido = async (codigo) => {
    const codeToSearch = codigo || inputCode;
    if (!codeToSearch) return;

    const pedidoEncontrado = await pedidosService.getByQrToken(codeToSearch);

    if (pedidoEncontrado) {
      setSelectedPedido(pedidoEncontrado);
      setDialogOpen(true);
      setAlertInfo(null);
    } else {
      setAlertInfo({
        severity: 'error',
        message: `No se encontró ningún pedido con el código QR: "${codeToSearch}"`,
      });
    }
  };

  const handleCompletarEntrega = async () => {
    if (!selectedPedido) return;

    const updated = await pedidosService.updateEstado(selectedPedido.id, 'entregado');
    setSelectedPedido(updated || { ...selectedPedido, estado: 'entregado' });

    setAlertInfo({
      severity: 'success',
      message: `¡Pedido #${selectedPedido.id} entregado con éxito a ${selectedPedido.cliente}!`,
    });
    setDialogOpen(false);
    setInputCode('');
  };

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
        Escáner y Validación de QR
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Escanea el código QR presentado por el alumno en su dispositivo móvil para validar la entrega de su pedido.
      </Typography>

      {alertInfo && (
        <Alert severity={alertInfo.severity} sx={{ mb: 3 }} onClose={() => setAlertInfo(null)}>
          {alertInfo.message}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Panel del Escáner */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: '100%',
                height: 280,
                backgroundColor: '#1e293b',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                mb: 3,
                border: '2px stroke #3b82f6',
              }}
            >
              <QrCodeScannerIcon sx={{ fontSize: 90, color: '#38bdf8', mb: 2 }} />
              <Typography variant="h6" fontWeight={600}>
                Lector de Código QR Activo
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', px: 4 }}>
                Apunta la cámara del lector o de la laptop al código QR del pedido del alumno.
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" color="text.secondary">
                O SIMULA EL ESCANEO MANUALMENTE
              </Typography>
            </Divider>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Código QR o ID de Pedido"
                placeholder="Ej: QR-1264-D ó 1264-D"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscarPedido()}
                size="medium"
              />
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                onClick={() => handleBuscarPedido()}
                sx={{ px: 4 }}
              >
                Validar
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Accesos Rápidos de Simulación para Demostración */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              🚀 Demostración Rápida de Escaneo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Haz clic en cualquiera de los pedidos activos simulados para probar la lectura instantánea:
            </Typography>

            <Stack spacing={2}>
              {[
                { id: '1264-D', token: 'QR-1264-D', cliente: 'Camila Silva', estado: 'pendiente' },
                { id: '0777-W', token: 'QR-0777-W', cliente: 'Tomás Vargas', estado: 'preparando' },
                { id: '0912-K', token: 'QR-0912-K', cliente: 'Valentina Rojas', estado: 'listo' },
              ].map((item) => (
                <Card
                  key={item.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  }}
                  onClick={() => handleBuscarPedido(item.token)}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography fontWeight={700}>
                          Pedido #{item.id} ({item.token})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Cliente: {item.cliente}
                        </Typography>
                      </Box>
                      <Button variant="outlined" size="small">
                        Simular Escaneo
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Modal de Validación de Pedido Escaneado */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        {selectedPedido && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight={800}>
                  Pedido #{selectedPedido.id}
                </Typography>
                <Chip
                  label={selectedPedido.estado.toUpperCase()}
                  color={
                    selectedPedido.estado === 'entregado'
                      ? 'success'
                      : selectedPedido.estado === 'listo'
                      ? 'info'
                      : 'warning'
                  }
                  fontWeight={700}
                />
              </Stack>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={2} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon color="action" />
                  <Typography fontWeight={600}>Cliente:</Typography>
                  <Typography>{selectedPedido.cliente}</Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon color="action" />
                  <Typography fontWeight={600}>Ubicación:</Typography>
                  <Typography variant="body2">{selectedPedido.ubicacion}</Typography>
                </Stack>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Detalle de Productos:
              </Typography>

              <List disablePadding>
                {selectedPedido.productos?.map((prod, idx) => (
                  <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={`${prod.cantidad}x ${prod.nombre}`}
                      secondary={prod.detalle !== 'Sin modificaciones' ? prod.detalle : null}
                    />
                    <Typography fontWeight={600}>
                      ${(prod.precio * prod.cantidad).toLocaleString('es-CL')}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight={700}>
                  Monto Total:
                </Typography>
                <Typography variant="h5" fontWeight={800} color="success.main">
                  ${selectedPedido.total?.toLocaleString('es-CL')}
                </Typography>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDialogOpen(false)} color="inherit">
                Cancelar
              </Button>

              {selectedPedido.estado !== 'entregado' ? (
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleCompletarEntrega}
                >
                  Marcar como Entregado
                </Button>
              ) : (
                <Button variant="contained" disabled startIcon={<CheckCircleIcon />}>
                  Ya Entregado
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default ScannerQr;