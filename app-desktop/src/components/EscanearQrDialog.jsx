import { useEffect, useRef, useState, useCallback } from 'react';
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import jsQR from 'jsqr';

import backendApi from '../services/backendApi';
import pedidosService, { normalizarTokenQR } from '../services/pedidosService';

const FALLOS_DE_CAMARA = new Set([
  'NotAllowedError',
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
  'SecurityError',
  'TypeError',
]);

const MENSAJES_DE_CAMARA = {
  NotAllowedError: 'Permiso de cámara denegado. Concede permisos de cámara en tu sistema.',
  NotFoundError: 'No se encontró ninguna cámara conectada en este equipo.',
  NotReadableError: 'La cámara está siendo utilizada por otra aplicación.',
  OverconstrainedError: 'La cámara no acepta la resolución solicitada.',
  SecurityError: 'El entorno de seguridad bloqueó el acceso a la cámara.',
  TypeError: 'El entorno no soporta captura de video.',
};

/**
 * Emite una señal acústica ascendente (dos tonos) al validar exitosamente un QR.
 */
function reproducirSonidoExito() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Re5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // La5

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch (e) {
    console.warn('AudioContext no disponible:', e);
  }
}

/**
 * Emite un tono grave de advertencia ante un QR rechazado o incorrecto.
 */
function reproducirSonidoRechazo() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch (e) {
    console.warn('AudioContext no disponible:', e);
  }
}

/**
 * Dispara una pulsación háptica / vibración en dispositivos compatibles.
 */
function ejecutarVibracion() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 60, 150]);
    }
  } catch {
    // Si no está soportado se ignora silenciosamente
  }
}

function EscanearQrDialog({ open, cafeteriaId, usuarioId, onClose }) {
  const procesando = useRef(false);
  const ultimoToken = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const usuarioIdRef = useRef(usuarioId);
  const resultadoRef = useRef(null);

  const [modo, setModo] = useState('qr'); // 'qr' | 'token'
  const [tokenInput, setTokenInput] = useState('');
  const [resultado, setResultado] = useState(null); // { valido, razon?, mensaje?, pedido? }
  const [errorConexion, setErrorConexion] = useState('');
  const [estadoCamara, setEstadoCamara] = useState('iniciando'); // 'iniciando' | 'activa' | 'error'
  const [errorCamara, setErrorCamara] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    usuarioIdRef.current = usuarioId;
  }, [usuarioId]);

  useEffect(() => {
    resultadoRef.current = resultado;
  }, [resultado]);

  // Detiene todas las pistas activas de la cámara y cancela el loop de animación
  const detenerCamara = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignorar
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetear = useCallback(() => {
    setResultado(null);
    setErrorConexion('');
    procesando.current = false;
    ultimoToken.current = null;
  }, []);

  const cerrar = useCallback(() => {
    detenerCamara();
    resetear();
    onClose();
  }, [detenerCamara, resetear, onClose]);

  // Manejo de reinicio al abrir/cerrar el diálogo
  useEffect(() => {
    if (open) {
      setModo('qr');
      setTokenInput('');
      setResultado(null);
      setErrorConexion('');
      setEstadoCamara('iniciando');
      setErrorCamara('');
      setIntento(0);
      procesando.current = false;
      ultimoToken.current = null;
    } else {
      detenerCamara();
    }
  }, [open, detenerCamara]);

  // Función principal de validación contra backend / Supabase
  const validar = useCallback(async (tokenCrudo) => {
    if (!tokenCrudo || procesando.current) return;

    const textoLimpio = String(tokenCrudo).trim();
    if (!textoLimpio) return;

    // Si ya mostró resultado para este mismo texto, evitar repetición continua
    if (ultimoToken.current === textoLimpio && resultadoRef.current) return;

    procesando.current = true;
    ultimoToken.current = textoLimpio;
    setErrorConexion('');

    console.log('[KDS Escáner] Procesando lectura de QR:', textoLimpio);

    // Extraer token candidato
    const token = normalizarTokenQR(textoLimpio);

    // Si el QR leído no contiene ningún formato de credencial reconocido
    if (!token) {
      console.warn('[KDS Escáner] QR sin formato de credencial válido:', textoLimpio);
      setResultado({
        valido: false,
        razon: 'Código QR no reconocido. No corresponde a un pedido de CoffeeFaster.',
        tokenLeido: textoLimpio,
      });
      reproducirSonidoRechazo();
      procesando.current = false;
      return;
    }

    try {
      let res = null;
      let fuePorBackend = false;

      try {
        res = await backendApi.validarQr(token);
        fuePorBackend = true;
      } catch (backendErr) {
        console.warn('[KDS Escáner] MS Comercio no disponible para validar QR, fallback a Supabase:', backendErr.message);
        res = await pedidosService.validarQrEntrega(token, usuarioIdRef.current);
      }

      // Si el MS Comercio rechazó (ej. no tenía el token en memoria), verificar en Supabase
      if (
        fuePorBackend &&
        res &&
        res.valido === false &&
        !res.razon?.includes('ya fue entregado') &&
        !res.razon?.includes('no está listo')
      ) {
        try {
          const porSupabase = await pedidosService.validarQrEntrega(token, usuarioIdRef.current);
          if (porSupabase && porSupabase.valido) {
            console.warn('[KDS Escáner] MS Comercio rechazó la credencial, Supabase sí la aceptó:', res.razon);
            res = porSupabase;
          }
        } catch {
          // Mantener el rechazo del backend
        }
      }

      // Garantizar que siempre haya una razón explicativa si es rechazo
      if (res && res.valido === false && !res.razon) {
        res.razon = 'Código QR o Token no válido para entrega.';
      }

      setResultado(res);

      if (res?.valido) {
        reproducirSonidoExito();
        ejecutarVibracion();
      } else {
        reproducirSonidoRechazo();
      }
    } catch (err) {
      console.error('[KDS Escáner] Error validando QR:', err);
      setResultado(null);
      setErrorConexion(err.message || 'Error de conexión: No se pudo contactar al servidor para validar el código.');
      reproducirSonidoRechazo();
    } finally {
      procesando.current = false;
    }
  }, []);

  // Inicialización de la cámara y loop continuo de detección con jsQR
  useEffect(() => {
    let cancelado = false;

    if (!open || modo !== 'qr' || resultado) {
      detenerCamara();
      return undefined;
    }

    const iniciarCamara = async () => {
      setEstadoCamara('iniciando');
      setErrorCamara('');

      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: 'environment' },
            },
            audio: false,
          });
        } catch {
          // Fallback con constraints mínimas
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;

        // Iniciar reproducción
        try {
          await video.play();
        } catch (playErr) {
          console.warn('[KDS Escáner] Error al ejecutar video.play():', playErr);
        }

        // Asegurar que el video tenga dimensiones con timeout de seguridad
        if (video.videoWidth === 0) {
          await new Promise((resolve) => {
            const onMeta = () => {
              cleanup();
              resolve();
            };
            const timer = setTimeout(() => {
              cleanup();
              resolve();
            }, 1200);
            const cleanup = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              video.removeEventListener('canplay', onMeta);
              clearTimeout(timer);
            };
            video.addEventListener('loadedmetadata', onMeta);
            video.addEventListener('canplay', onMeta);
          });
        }

        if (cancelado) return;
        setEstadoCamara('activa');

        let ultimoEscaneo = 0;
        const tick = (ahora) => {
          if (cancelado) return;

          // Escanear cada ~140ms cuando no se está procesando y no hay resultado visible
          if (
            !procesando.current &&
            !resultadoRef.current &&
            ahora - ultimoEscaneo >= 140 &&
            video &&
            video.readyState >= 2 && // HAVE_CURRENT_DATA o superior
            video.videoWidth > 0
          ) {
            ultimoEscaneo = ahora;
            const canvas = canvasRef.current;
            if (canvas) {
              // Escala óptima: hasta 1000px para nitidez máxima sin degradar frames
              const maxDim = 1000;
              const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
              const w = Math.floor(video.videoWidth * scale);
              const h = Math.floor(video.videoHeight * scale);
              canvas.width = w;
              canvas.height = h;

              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const qr = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });

                if (qr && qr.data && qr.data.trim()) {
                  void validar(qr.data.trim());
                }
              }
            }
          }

          animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelado) return;
        console.error('[KDS Escáner] Error al abrir cámara:', err);
        setEstadoCamara('error');
        const mensaje =
          FALLOS_DE_CAMARA.has(err.name) && MENSAJES_DE_CAMARA[err.name]
            ? MENSAJES_DE_CAMARA[err.name]
            : err.message || 'No se pudo acceder a la cámara.';
        setErrorCamara(mensaje);
      }
    };

    void iniciarCamara();

    return () => {
      cancelado = true;
      detenerCamara();
    };
  }, [open, modo, resultado, intento, detenerCamara, validar]);

  const reencenderCamara = () => {
    setErrorCamara('');
    setEstadoCamara('iniciando');
    setIntento((n) => n + 1);
  };

  // Soporte para cargar imagen con QR (útil para pruebas y contingencia)
  const procesarImagenSubida = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const scale = Math.min(1, 800 / img.width);
        const w = Math.floor(img.width * scale);
        const h = Math.floor(img.height * scale);
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const qr =
          jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' }) ||
          jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });

        if (qr && qr.data && qr.data.trim()) {
          void validar(qr.data.trim());
        } else {
          setResultado({
            valido: false,
            razon: 'No se detectó ningún código QR en la imagen seleccionada.',
          });
          reproducirSonidoRechazo();
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
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

        {/* Contenedor del Visor / Lector */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxHeight: 380,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: '#1A110C',
            mx: 'auto',
          }}
        >
          {/* Canvas oculto para decodificación con jsQR */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {modo === 'qr' && !resultado ? (
            <>
              {/* Elemento de video nativo */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: estadoCamara === 'activa' ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              />

              {/* Guía visual / Retícula de escaneo */}
              {estadoCamara === 'activa' && (
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
                  <Box
                    sx={{
                      width: '68%',
                      height: '68%',
                      border: '2px solid rgba(255, 255, 255, 0.75)',
                      borderRadius: 3,
                      position: 'relative',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        backgroundColor: '#4CAF50',
                        boxShadow: '0 0 8px #4CAF50',
                        animation: 'scanLaser 2s infinite ease-in-out',
                        '@keyframes scanLaser': {
                          '0%': { top: '5%' },
                          '50%': { top: '95%' },
                          '100%': { top: '5%' },
                        },
                      }}
                    />
                  </Box>
                </Box>
              )}

              {/* Overlay mientras enciende o en caso de error de cámara */}
              {estadoCamara !== 'activa' && (
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
                  }}
                >
                  {estadoCamara === 'iniciando' ? (
                    <>
                      <CircularProgress size={36} sx={{ color: 'rgba(255,255,255,0.85)' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        Iniciando cámara...
                      </Typography>
                    </>
                  ) : (
                    <>
                      <VideocamOffIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.7)' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>
                        {errorCamara || 'No se pudo acceder a la cámara.'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Puedes ingresar el código manualmente o subir una imagen del QR.
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={reencenderCamara}
                          sx={{ minHeight: 40 }}
                        >
                          Reintentar cámara
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => fileInputRef.current?.click()}
                          startIcon={<UploadFileIcon />}
                          sx={{ minHeight: 40, color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.5)' }}
                        >
                          Subir imagen
                        </Button>
                      </Stack>
                    </>
                  )}
                </Box>
              )}
            </>
          ) : modo === 'token' && !resultado ? (
            /* Modo ingreso manual de token */
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
                Ingrese el token de retiro del pedido (QR, código diario o código de contingencia).
              </Typography>
              <TextField
                autoFocus
                fullWidth
                size="medium"
                variant="outlined"
                label="Código / Token"
                placeholder="Ej. QR-TST-0001 o CF-XXXXXX"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void validar(tokenInput);
                }}
                slotProps={{
                  input: { startAdornment: <KeyIcon sx={{ color: 'rgba(255,255,255,0.6)', mr: 1 }} /> },
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
          ) : null}

          {/* DIFERENCIACIÓN VISUAL DE RESULTADOS */}

          {/* 1. RESULTADO VÁLIDO / ÉXITO (Verde) */}
          {resultado && resultado.valido && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#1E2C22',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                textAlign: 'center',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 64, color: '#4CAF50', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#E8F5E9', mb: 1 }}>
                ¡Entrega Validada Exitosamente!
              </Typography>
              <Typography variant="body2" sx={{ color: '#C8E6C9', mb: 2 }}>
                {resultado.mensaje || 'El pedido fue marcado como entregado.'}
              </Typography>
              {resultado.pedido && (
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    width: '100%',
                    maxWidth: 320,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                    Pedido #{resultado.pedido.id}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#A5D6A7', display: 'block' }}>
                    Estado actual: Entregado
                  </Typography>
                  {resultado.pedido.usuarios?.nombre && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                      Cliente: {resultado.pedido.usuarios.nombre}
                    </Typography>
                  )}
                </Box>
              )}
              <Button
                variant="contained"
                color="success"
                onClick={resetear}
                startIcon={<RefreshIcon />}
                sx={{ mt: 2, minHeight: 40 }}
              >
                Escanear otro pedido
              </Button>
            </Box>
          )}

          {/* 2. RESULTADO RECHAZADO COMERCIAL (Ámbar / Naranja) */}
          {resultado && !resultado.valido && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#2D2013',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                textAlign: 'center',
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 64, color: '#FFB74D', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#FFE0B2', mb: 1 }}>
                Validación Rechazada
              </Typography>
              <Typography variant="body2" sx={{ color: '#FFCC80', mb: 2, maxWidth: 320, fontWeight: 500 }}>
                {resultado.razon || 'El código no cumple las condiciones para ser retirado.'}
              </Typography>
              {resultado.pedido && (
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    width: '100%',
                    maxWidth: 320,
                    mb: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', display: 'block' }}>
                    Pedido #{resultado.pedido.id} · Estado: {resultado.pedido.estado}
                  </Typography>
                </Box>
              )}
              <Button
                variant="contained"
                onClick={resetear}
                startIcon={<RefreshIcon />}
                sx={{
                  mt: 1,
                  minHeight: 40,
                  backgroundColor: '#E65100',
                  '&:hover': { backgroundColor: '#BF360C' },
                }}
              >
                Escanear otro código
              </Button>
            </Box>
          )}
        </Box>

        {/* Input oculto para subida de archivo QR */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={procesarImagenSubida}
        />

        {/* 3. RESULTADO ERROR DE CONEXIÓN / RED (Rojo) */}
        {errorConexion && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              Error de Conexión
            </Typography>
            <Typography variant="body2">
              {errorConexion}
            </Typography>
          </Alert>
        )}

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {modo === 'qr'
              ? 'Apunta la cámara al código QR generado por la app móvil.'
              : 'Acepta token del QR, código de contingencia o ID del pedido.'}
          </Typography>
          {modo === 'qr' && !resultado && (
            <Button
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Cargar imagen QR
            </Button>
          )}
        </Stack>
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