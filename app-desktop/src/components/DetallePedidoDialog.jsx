import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReplayIcon from '@mui/icons-material/Replay';

import EstadoChip from './EstadoChip';
import { parsearFecha, formatearHora } from '../utils/dateUtils';
import { generarBoletaBlob } from '../services/boletaPdfService';
import impresionService from '../services/impresionService';
import pedidosService from '../services/pedidosService';

function getHoraRetiro(pedido) {
  if (pedido?.hora_retiro) return formatearHora(pedido.hora_retiro);
  if (pedido?.franja_retiro) return pedido.franja_retiro;
  if (pedido?.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) {
      return formatearHora(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function DetallePedidoDialog({ pedido, onClose, onChangeEstado }) {
  const [pedidoDetallado, setPedidoDetallado] = useState(pedido);
  const [descargandoBoleta, setDescargandoBoleta] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [estadoImpresion, setEstadoImpresion] = useState({ veces: 0, esReimpresion: false });
  const [snackbar, setSnackbar] = useState({ open: false, mensaje: '', severity: 'info' });

  const pedidoActual = pedidoDetallado || pedido;
  const pedidoId = pedidoActual?.rawId ?? pedidoActual?.id;

  useEffect(() => {
    setPedidoDetallado(pedido);
    if (!pedido) {
      setEstadoImpresion({ veces: 0, esReimpresion: false });
      return;
    }

    const id = pedido.rawId ?? pedido.id;
    setEstadoImpresion(impresionService.getEstadoImpresion(id));

    // Si el pedido no trae productos o su lista está vacía, consultamos la BD para traer los detalles completos
    if (!pedido.productos || pedido.productos.length === 0) {
      pedidosService.getById(id)
        .then((completo) => {
          if (completo && completo.productos && completo.productos.length > 0) {
            setPedidoDetallado(completo);
          }
        })
        .catch((err) => {
          console.warn('No se pudieron recargar detalles del pedido:', err);
        });
    }
  }, [pedido]);

  // Manejador para imprimir comanda de cocina (80mm sin precios) vía iframe aislado
  const handleImprimirComanda = async () => {
    if (!pedidoActual) return;
    setImprimiendo(true);

    try {
      let pedidoParaImprimir = pedidoActual;
      // Precargar ítems de la BD si aún no estuvieran en memoria
      if (!pedidoParaImprimir.productos || pedidoParaImprimir.productos.length === 0) {
        try {
          const completo = await pedidosService.getById(pedidoId);
          if (completo && completo.productos && completo.productos.length > 0) {
            pedidoParaImprimir = completo;
            setPedidoDetallado(completo);
          }
        } catch (e) {
          console.warn('No se pudo precargar detalle completo antes de imprimir:', e);
        }
      }

      const nuevoEstado = impresionService.registrarImpresion(pedidoId);
      setEstadoImpresion(nuevoEstado);

      await impresionService.imprimirComanda(pedidoParaImprimir, nuevoEstado);

      setSnackbar({
        open: true,
        mensaje: nuevoEstado.veces > 1
          ? `Reimpresión de comanda #${pedidoParaImprimir.codigo_pedido || pedidoParaImprimir.id} enviada (Copia #${nuevoEstado.veces})`
          : `Comanda #${pedidoParaImprimir.codigo_pedido || pedidoParaImprimir.id} enviada a impresión`,
        severity: nuevoEstado.veces > 1 ? 'warning' : 'success',
      });
    } catch (err) {
      console.error('Error al enviar comanda a impresión:', err);
      setSnackbar({
        open: true,
        mensaje: 'Error al enviar la comanda a la impresora.',
        severity: 'error',
      });
    } finally {
      setImprimiendo(false);
    }
  };

  // Manejador para imprimir boleta en ticket térmico de 80mm vía iframe aislado
  const handleImprimirBoleta = async () => {
    if (!pedidoActual) return;
    setImprimiendo(true);

    try {
      let pedidoParaImprimir = pedidoActual;
      if (!pedidoParaImprimir.productos || pedidoParaImprimir.productos.length === 0) {
        try {
          const completo = await pedidosService.getById(pedidoId);
          if (completo && completo.productos && completo.productos.length > 0) {
            pedidoParaImprimir = completo;
            setPedidoDetallado(completo);
          }
        } catch (e) {
          console.warn('No se pudo precargar detalle completo antes de imprimir:', e);
        }
      }

      await impresionService.imprimirBoleta(pedidoParaImprimir);

      setSnackbar({
        open: true,
        mensaje: `Boleta #${pedidoParaImprimir.codigo_pedido || pedidoParaImprimir.id} enviada a impresión térmica`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Error al imprimir boleta térmica:', err);
      setSnackbar({
        open: true,
        mensaje: 'Error al enviar la boleta a impresión térmica.',
        severity: 'error',
      });
    } finally {
      setImprimiendo(false);
    }
  };

  // Manejador para descargar la boleta en PDF permitiendo seleccionar ubicación
  const handleDescargarBoleta = async () => {
    if (!pedidoActual) return;
    try {
      setDescargandoBoleta(true);
      const blob = await generarBoletaBlob(pedidoActual);
      const codigoLimpio = String(pedidoActual.codigo_pedido || pedidoActual.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const nombreSugerido = `boleta-pedido-${codigoLimpio}.pdf`;

      const resultado = await impresionService.guardarArchivoConUbicacion(blob, nombreSugerido);

      if (resultado.ok) {
        setSnackbar({
          open: true,
          mensaje: resultado.ruta
            ? `Boleta guardada con éxito en ${resultado.ruta}`
            : 'Boleta descargada con éxito',
          severity: 'success',
        });
      } else if (!resultado.cancelado) {
        setSnackbar({
          open: true,
          mensaje: 'No fue posible guardar la boleta. Inténtalo de nuevo.',
          severity: 'error',
        });
      }
    } catch (err) {
      console.error('Error al generar o guardar la boleta:', err);
      setSnackbar({
        open: true,
        mensaje: `Error al generar la boleta: ${err.message || 'Error desconocido'}`,
        severity: 'error',
      });
    } finally {
      setDescargandoBoleta(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <>
      <Dialog
        open={Boolean(pedidoActual)}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        disableEnforceFocus={imprimiendo}
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        {pedidoActual && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#2B2118' }}>
                    Detalle de Comanda {pedidoActual.codigo_pedido || `#${pedidoActual.id}`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {pedidoActual.cafeteria_nombre || pedidoActual.ubicacion || 'Cafetería CoffeeFast'}
                  </Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ minHeight: 48, minWidth: 48 }}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>

            <DialogContent dividers>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EstadoChip estado={pedidoActual.estado} />
                  {estadoImpresion.veces > 0 && (
                    <Chip
                      size="small"
                      icon={<PrintIcon style={{ fontSize: 16 }} />}
                      label={
                        estadoImpresion.veces > 1
                          ? `Reimpresa (${estadoImpresion.veces}x)`
                          : 'Comanda Impresa'
                      }
                      color={estadoImpresion.veces > 1 ? 'warning' : 'success'}
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                </Stack>
                <Typography fontWeight={800} sx={{ color: '#4A3B32' }}>
                  🕐 Retiro: {getHoraRetiro(pedidoActual)}
                </Typography>
              </Stack>

              {/* Información comercial y de cliente (coherente con boleta M4) */}
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 2,
                  backgroundColor: '#F8F5F2',
                  border: '1px solid #EFEAE6',
                }}
              >
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Cliente:
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {pedidoActual.cliente || 'Cliente General'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Método de Pago:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    {pedidoActual.metodo_pago || 'Wallet'} (Aprobado)
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total Pagado:
                  </Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ color: '#4A3B32', fontSize: '1rem' }}>
                    ${(Number(pedidoActual.total) || 0).toLocaleString('es-CL')}
                  </Typography>
                </Stack>
                {pedidoActual.codigo_retiro_diario && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Código Retiro Contingencia:
                    </Typography>
                    <Typography variant="body2" fontWeight={800} sx={{ color: '#1B5E20' }}>
                      {pedidoActual.codigo_retiro_diario}
                    </Typography>
                  </Stack>
                )}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#4A3B32' }}>
                Ítems de Preparación:
              </Typography>
              <List disablePadding>
                {pedidoActual.productos && pedidoActual.productos.length > 0 ? (
                  pedidoActual.productos.map((prod, idx) => (
                    <ListItem
                      key={idx}
                      disableGutters
                      sx={{
                        py: 0.8,
                        borderBottom: idx < pedidoActual.productos.length - 1 ? '1px dashed #E0D7D0' : 'none',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography fontWeight={700} sx={{ fontSize: '0.98rem' }}>
                              {prod.nombre} × {prod.cantidad}
                            </Typography>
                            {prod.precio ? (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                ${(Number(prod.precio) * Number(prod.cantidad)).toLocaleString('es-CL')}
                              </Typography>
                            ) : null}
                          </Stack>
                        }
                        secondary={
                          prod.detalle && prod.detalle !== 'Sin modificaciones' ? (
                            <Typography variant="caption" sx={{ color: '#D84315', fontStyle: 'italic' }}>
                              Nota: {prod.detalle}
                            </Typography>
                          ) : null
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography fontWeight={700} sx={{ fontSize: '0.98rem' }}>
                            Consumo Cafetería × 1
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            ${(Number(pedidoActual.total) || 0).toLocaleString('es-CL')}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Ítem general del pedido
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
              {/* Acciones de Impresión y Descarga */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  startIcon={estadoImpresion.veces > 0 ? <ReplayIcon /> : <PrintIcon />}
                  variant={estadoImpresion.veces > 0 ? 'outlined' : 'contained'}
                  color={estadoImpresion.veces > 0 ? 'warning' : 'primary'}
                  onClick={handleImprimirComanda}
                  disabled={imprimiendo}
                  sx={{
                    minHeight: 46,
                    fontWeight: 800,
                    backgroundColor: estadoImpresion.veces > 0 ? 'transparent' : '#4A3B32',
                    color: estadoImpresion.veces > 0 ? '#E65100' : '#FFFFFF',
                    borderColor: estadoImpresion.veces > 0 ? '#E65100' : '#4A3B32',
                    '&:hover': {
                      backgroundColor: estadoImpresion.veces > 0 ? '#FFF3E0' : '#392C25',
                      borderColor: estadoImpresion.veces > 0 ? '#BF360C' : '#392C25',
                    },
                  }}
                >
                  {estadoImpresion.veces > 0 ? 'Reimprimir Comanda' : 'Imprimir Comanda'}
                </Button>

                <Button
                  startIcon={descargandoBoleta ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                  variant="outlined"
                  onClick={handleDescargarBoleta}
                  disabled={descargandoBoleta}
                  sx={{
                    minHeight: 46,
                    fontWeight: 700,
                    borderColor: '#4A3B32',
                    color: '#4A3B32',
                    '&:hover': {
                      borderColor: '#2B2118',
                      backgroundColor: '#F2ECE7',
                    },
                  }}
                >
                  Descargar Boleta
                </Button>

                <Tooltip title="Imprimir boleta de cliente en ticket térmico (80mm)">
                  <IconButton
                    onClick={handleImprimirBoleta}
                    disabled={imprimiendo}
                    sx={{
                      minHeight: 46,
                      minWidth: 46,
                      border: '1px solid #C8B2A1',
                      borderRadius: 2,
                      color: '#4A3B32',
                      '&:hover': {
                        backgroundColor: '#F2ECE7',
                        borderColor: '#4A3B32',
                      },
                    }}
                  >
                    <ReceiptIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Acciones de Flujo de Estado */}
              <Stack direction="row" spacing={1} alignItems="center">
                {pedidoActual.estado === 'pendiente' && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => onChangeEstado(pedidoActual.rawId ?? pedidoActual.id, 'en_preparacion')}
                    sx={{ minHeight: 46, fontWeight: 700 }}
                  >
                    Iniciar Preparación
                  </Button>
                )}
                {pedidoActual.estado === 'en_preparacion' && (
                  <Button
                    variant="contained"
                    color="info"
                    startIcon={<CheckIcon />}
                    onClick={() => onChangeEstado(pedidoActual.rawId ?? pedidoActual.id, 'listo')}
                    sx={{ minHeight: 46, fontWeight: 700 }}
                  >
                    Marcar Como Listo
                  </Button>
                )}
                {pedidoActual.estado === 'listo' && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', maxWidth: 220 }}>
                    Entrega pendiente: usa el botón "Escanear QR" de la barra superior.
                  </Typography>
                )}
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Feedback de notificaciones tipo snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%', fontWeight: 600 }}>
          {snackbar.mensaje}
        </Alert>
      </Snackbar>
    </>
  );
}

export default DetallePedidoDialog;