import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyIcon from '@mui/icons-material/Key';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { QrReader } from 'react-qr-reader';

import backendApi from '../services/backendApi';
import pedidosService, { normalizarTokenQR } from '../services/pedidosService';

function EscanearQrDialog({ open, cafeteriaId, onClose }) {
  const procesando = useRef(false);
  const ultimoToken = useRef(null);
  const [modo, setModo] = useState('qr'); // 'qr' | 'token'
  const [tokenInput, setTokenInput] = useState('');
  const [resultado, setResultado] = useState(null); // { valido, razon?, mensaje?, pedido? }
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setModo('qr');
      setTokenInput('');
      setResultado(null);
      setError('');
      procesando.current = false;
      ultimoToken.current = null;
    }
  }, [open]);

  const validar = async (tokenCrudo) => {
    const token = normalizarTokenQR(tokenCrudo);
    if (!token || procesando.current || ultimoToken.current === token) return;
    procesando.current = true;
    ultimoToken.current = token;
    setError('');
    try {
      let res;
      try {
        res = await backendApi.validarQr(token);
      } catch (backendErr) {
        console.warn('MS Comercio no disponible para validar QR, fallback a Supabase:', backendErr.message);
        res = await pedidosService.validarQrEntrega(token);
      }
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
    procesando.current = false;
    ultimoToken.current = null;
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
        <Tabs
          value={modo}
          onChange={(_e, nuevoModo) => {
            resetear();
            setModo(nuevoModo);
          }}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab icon={<QrCodeScannerIcon />} iconPosition="start" label="Escanear QR" value="qr" />
          <Tab icon={<KeyIcon />} iconPosition="start" label="Ingresar Token" value="token" />
        </Tabs>

        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxHeight: 400,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: '#1A110C',
            mx: 'auto',
          }}
        >
          {modo === 'qr' ? (
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
                isScanning && !resultado && (
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
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                p: 3,
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
                Ingrese el token del pedido (código QR, de retiro diario o ID).
              </Typography>
              <TextField
                autoFocus
                fullWidth
                size="medium"
                variant="outlined"
                label="Token"
                placeholder="Ej. QR-TST-0001"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void validar(tokenInput);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
              <Button
                variant="contained"
                size="large"
                sx={{ minHeight: 48 }}
                disabled={!tokenInput.trim() || procesando.current}
                onClick={() => void validar(tokenInput)}
              >
                Validar Token
              </Button>
            </Box>
          )}

          {resultado && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#1A110C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
              }}
            >
              <Stack spacing={2} sx={{ width: '100%' }}>
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
            </Box>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
          {modo === 'qr'
            ? 'El QR debe corresponder a un pedido en estado "listo" de esta cafetería.'
            : 'El token debe corresponder a un pedido en estado "listo" de esta cafetería y es de un solo uso.'}
        </Typography>

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
              {modo === 'qr' ? 'Escanear otro' : 'Validar otro'}
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