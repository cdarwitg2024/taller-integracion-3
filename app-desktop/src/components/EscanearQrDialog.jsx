import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { QrReader } from 'react-qr-reader';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import backendApi from '../services/backendApi';

function EscanearQrDialog({ open, cafeteriaId, onClose }) {
  const procesando = useRef(false);
  const [resultado, setResultado] = useState(null); // { valido, razon?, mensaje?, pedido? }
  const [error, setError] = useState('');
  const [leido, setLeido] = useState(false);

  const validar = async (token) => {
    if (procesando.current) return;
    procesando.current = true;
    setLeido(true);
    setError('');
    try {
      const res = await backendApi.validarQr(token);
      setResultado(res);
    } catch (err) {
      setResultado(null);
      setError(err.message || 'No se pudo validar el QR');
    } finally {
      procesando.current = false;
    }
  };

  const resetear = () => {
    setResultado(null);
    setError('');
    setLeido(false);
    procesando.current = false;
  };

  const cerrar = () => {
    resetear();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={cerrar}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={800}>
            Escanear QR de Entrega
          </Typography>
          <IconButton onClick={cerrar} sx={{ minHeight: 48, minWidth: 48 }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {resultado ? (
          <Stack spacing={2}>
            <Alert severity={resultado.valido ? 'success' : 'error'}>
              {resultado.valido
                ? resultado.mensaje || 'Entrega validada exitosamente.'
                : `Validación rechazada: ${resultado.razon || 'QR no válido'}`}
            </Alert>
            {resultado.pedido && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Pedido #{resultado.pedido.id} · {resultado.pedido.estado}
              </Typography>
            )}
          </Stack>
        ) : (
          <>
            <Box
              sx={{
                width: '100%',
                aspectRatio: '1',
                maxHeight: 400,
                borderRadius: 3,
                overflow: 'hidden',
                backgroundColor: '#1A110C',
                mx: 'auto',
              }}
            >
              <QrReader
                onResult={(result, scanError) => {
                  if (result?.text) {
                    void validar(String(result.text));
                  }
                  if (scanError) {
                    // errores de cámara/percepción: no bloquear la captura
                  }
                }}
                constraints={{ facingMode: 'environment' }}
                scanDelay={400}
                ViewFinder={({ isScanning }) =>
                  isScanning && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <QrCodeScannerIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.6)' }} />
                    </Box>
                  )
                }
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
              El QR debe corresponder a un pedido en estado "listo" de esta cafetería.
            </Typography>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Cafetería #{cafeteriaId}
        </Typography>
        <Stack direction="row" spacing={1}>
          {resultado && (
            <Button onClick={resetear} variant="outlined" sx={{ minHeight: 48 }}>
              Escanear otro
            </Button>
          )}
          <Button onClick={cerrar} variant="contained" sx={{ minHeight: 48 }}>
            Cerrar
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default EscanearQrDialog;