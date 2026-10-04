import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyIcon from '@mui/icons-material/Key';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { QrReader } from 'react-qr-reader';

import backendApi from '../services/backendApi';
import pedidosService, { normalizarTokenQR } from '../services/pedidosService';

// Durante el escaneo normal zxing lanza NotFoundException miles de veces por
// segundo mientras busca un codigo: eso NO es un fallo de camara y no debe
// mostrarse. Solo estos nombres significan que la camara no se pudo prender.
const FALLOS_DE_CAMARA = new Set([
  'NotAllowedError',
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
  'SecurityError',
  'TypeError',
]);

const MENSAJES_DE_CAMARA = {
  NotAllowedError: 'Permiso de camara denegado. Hay que autorizarla en los ajustes del sistema para esta app.',
  NotFoundError: 'No se encontro ninguna camara conectada.',
  NotReadableError: 'La camara esta siendo usada por otro programa. Cerralo y vuelve a intentar.',
  OverconstrainedError: 'La camara no acepta la configuracion solicitada.',
  SecurityError: 'El navegador bloqueo el acceso a la camara por politica de seguridad.',
  TypeError: 'El entorno no permite abrir la camara.',
};

const esFalloDeCamara = (error) => {
  if (!error) return false;
  if (FALLOS_DE_CAMARA.has(error.name)) return true;
  return /mediaDevices|getUserMedia/i.test(String(error.message || ''));
};

function EscanearQrDialog({ open, cafeteriaId, onClose }) {
  const procesando = useRef(false);
  const ultimoToken = useRef(null);
  const [modo, setModo] = useState('qr'); // 'qr' | 'token'
  const [tokenInput, setTokenInput] = useState('');
  const [resultado, setResultado] = useState(null); // { valido, razon?, mensaje?, pedido? }
  const [error, setError] = useState('');
  const [estadoCamara, setEstadoCamara] = useState('iniciando'); // 'iniciando' | 'activa' | 'error'
  const [errorCamara, setErrorCamara] = useState('');
  const [intento, setIntento] = useState(0);

  // react-qr-reader corre su efecto con dependencias vacias, por lo que nunca
  // reintenta solo. Cambiar `intento` cambia el key del componente y fuerza el
  // remontaje, que es lo unico que vuelve a disparar getUserMedia.
  const videoId = `qr-video-${intento}`;

  useEffect(() => {
    if (open) {
      setModo('qr');
      setTokenInput('');
      setResultado(null);
      setError('');
      setEstadoCamara('iniciando');
      setErrorCamara('');
      setIntento(0);
      procesando.current = false;
      ultimoToken.current = null;
    }
  }, [open]);

  // Confirma que la camara se prendio de verdad. La libreria no avisa cuando el
  // video arranca, asi que se mira el stream del elemento <video> directamente.
  useEffect(() => {
    if (!open || modo !== 'qr') return undefined;

    setEstadoCamara('iniciando');
    setErrorCamara('');

    const temporizador = setTimeout(() => {
      const video = document.getElementById(videoId);
      if (video?.srcObject) {
        setEstadoCamara('activa');
        return;
      }
      setEstadoCamara((previo) => {
        if (previo === 'error') return previo; // ya hay un error mas preciso
        return 'error';
      });
      setErrorCamara(
        'La camara no respondio. Puede estar apagada en Windows (tecla Win+C) o ocupada por otra aplicacion.'
      );
    }, 2500);

    return () => clearTimeout(temporizador);
  }, [open, modo, videoId]);

  const reencenderCamara = () => {
    setErrorCamara('');
    setEstadoCamara('iniciando');
    setIntento((n) => n + 1);
  };

  const validar = async (tokenCrudo) => {
    const token = normalizarTokenQR(tokenCrudo);
    if (!token || procesando.current) return;

    // El bloqueo por credencial solo aplica a una entrega ya concretada: impide
    // que el lector de QR dispare la misma entrega 10 veces por segundo. Si la
    // validacion fallo, la misma credencial se puede volver a intentar (por
    // ejemplo, tras un corte de red) sin tener que cerrar el dialogo.
    if (ultimoToken.current === token && resultado?.valido) return;

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

      // El MS Comercio y Supabase pueden conocer credenciales distintas del mismo
      // pedido (por ejemplo, el backend solo tiene el qr_token y el cliente tiene
      // el token de contingencia). Si la primera via rechaza, se prueba la segunda
      // antes de mostrar el rechazo: el token de contingencia tiene que poder
      // entregar un pedido cuyo QR no se pudo validar, y viceversa.
      if (res && res.valido === false) {
        const porSupabase = await pedidosService.validarQrEntrega(token);
        if (porSupabase.valido) {
          console.warn('MS Comercio rechazo la credencial, Supabase si la acepto:', res.razon);
          res = porSupabase;
        }
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
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center'}}>
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
              key={intento}
              videoId={videoId}
              onResult={(result, scanError) => {
                if (esFalloDeCamara(scanError)) {
                  setEstadoCamara('error');
                  setErrorCamara(
                    MENSAJES_DE_CAMARA[scanError.name] ||
                      scanError.message ||
                      'No se pudo acceder a la camara.'
                  );
                }
                if (result?.text) {
                  setEstadoCamara('activa');
                  void validar(String(result.text));
                }
              }}
              // 'environment' va como ideal y no como exigida: en una webcam de
              // notebook exigir la camara trasera lanzaba OverconstrainedError y
              // la camara no prendia nunca.
              constraints={{ facingMode: { ideal: 'environment' } }}
              scanDelay={400}
              ViewFinder={({ isScanning }) =>
                isScanning && !resultado && estadoCamara === 'activa' && (
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
                slotProps={{
                  input: { startAdornment: <KeyIcon sx={{ color: 'rgba(255,255,255,0.6)' }} /> },
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

          {modo === 'qr' && !resultado && estadoCamara !== 'activa' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                p: 3,
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {estadoCamara === 'iniciando' ? (
                <>
                  <CircularProgress size={34} sx={{ color: 'rgba(255,255,255,0.85)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                    Encendiendo camara...
                  </Typography>
                </>
              ) : (
                <>
                  <VideocamOffIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.7)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {errorCamara || 'No se pudo encender la camara.'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Puedes ingressar el token a mano en la pestana de al lado.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={reencenderCamara}
                    sx={{ minHeight: 44, pointerEvents: 'auto' }}
                  >
                    Reintentar camara
                  </Button>
                </>
              )}
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
            : 'Acepta el token del QR, el de contingencia o el código del pedido (ej. 15-QAD). Sirve cualquiera de los tres.'}
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