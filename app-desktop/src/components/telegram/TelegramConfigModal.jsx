import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  InputAdornment,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import TelegramIcon from '@mui/icons-material/Telegram';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { telegramDuenoService } from '../../service/telegram_dueno';

function TelegramConfigModal({ open, onClose, currentUser, onConfigUpdated }) {
  const [chatId, setChatId] = useState('');
  const [showChatId, setShowChatId] = useState(false);
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);
  const [configActual, setConfigActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });


  const duenoId = currentUser?.id || 1;
  const cafeteriaId = currentUser?.cafeteria_id || 1;

  const loadConfig = async () => {
    if (!open) return;
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const config = await telegramDuenoService.getConfiguracion(duenoId);
      if (config) {
        setConfigActual(config);
        setChatId(String(config.telegram_chat_id || ''));
        setNotificacionesActivas(config.notificaciones_activas !== false);
      } else {
        setConfigActual(null);
        setChatId('');
        setNotificacionesActivas(true);
      }
    } catch (err) {
      console.warn('Error cargando configuración de Telegram:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [open, duenoId]);

  const handleSave = async () => {
    setFeedback({ type: '', message: '' });
    const cleanChatId = chatId.trim();

    if (!cleanChatId) {
      setFeedback({ type: 'error', message: 'Por favor, ingrese un Chat ID de Telegram válido.' });
      return;
    }

    if (!/^-?\d+$/.test(cleanChatId)) {
      setFeedback({ type: 'error', message: 'El Chat ID debe ser un número (positivo o con prefijo negativo).' });
      return;
    }

    setSaving(true);
    try {
      const saved = await telegramDuenoService.guardarConfiguracion({
        usuarioId: duenoId,
        cafeteriaId: cafeteriaId,
        telegramChatId: cleanChatId,
        notificacionesActivas: notificacionesActivas,
      });

      setConfigActual(saved);
      setFeedback({
        type: 'success',
        message: '¡Bot de Telegram vinculado exitosamente a tu cuenta de Dueño!',
      });
      if (onConfigUpdated) onConfigUpdated(saved);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al guardar la vinculación en el servidor.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!configActual?.telegram_chat_id) return;
    setTesting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await telegramDuenoService.enviarAlertaPrueba({
        usuarioId: duenoId,
        usuarioNombre: currentUser?.nombre || 'Carlos',
        cafeteriaId: cafeteriaId,
        telegramChatId: configActual.telegram_chat_id,
      });
      setFeedback({
        type: 'success',
        message: res.message || 'Alerta de prueba enviada a tu Telegram.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'No se pudo enviar la alerta de prueba. Verifica la conexión con el bot.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDesvincular = async () => {
    setSaving(true);
    setFeedback({ type: '', message: '' });
    try {
      await telegramDuenoService.desvincular(duenoId);
      setConfigActual(null);
      setChatId('');
      setFeedback({
        type: 'info',
        message: 'Tu cuenta de Telegram ha sido desvinculada del sistema.',
      });
      if (onConfigUpdated) onConfigUpdated(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Error al desvincular la cuenta de Telegram.',
      });
    } finally {
      setSaving(false);
    }
  };

  const isConectado = Boolean(configActual?.telegram_chat_id);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          p: 1.5,
          boxShadow: '0 16px 40px rgba(67, 50, 37, 0.18)',
          backgroundColor: '#FFFFFF',
        },
      }}
    >
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {/* Cabecera del Diálogo */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                backgroundColor: '#0088CC1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0088CC',
              }}
            >
              <TelegramIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#4A3728', lineHeight: 1.2 }}>
                Bot de Alertas Telegram
              </Typography>
            </Box>
          </Stack>

          <IconButton size="small" onClick={onClose} sx={{ color: '#8C7A6F' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={36} sx={{ color: '#C86237' }} />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {/* Estado Actual de Vinculación */}
            <Box
              sx={{
                p: 2,
                borderRadius: '12px',
                backgroundColor: isConectado ? '#E8F5E9' : '#FAF7F4',
                border: `1px solid ${isConectado ? '#C8E6C9' : '#EFEAE6'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                {isConectado ? (
                  <CheckCircleOutlinedIcon sx={{ color: '#2E7D32', fontSize: 24 }} />
                ) : (
                  <NotificationsActiveOutlinedIcon sx={{ color: '#C86237', fontSize: 24 }} />
                )}
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: isConectado ? '#1B5E20' : '#4A3728' }}>
                    {isConectado ? 'Dispositivo Vinculado Activo' : 'Sin Dispositivo Vinculado'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isConectado ? '#2E7D32' : '#8C7A6F' }}>
                    {isConectado
                      ? `Chat ID: ${showChatId ? configActual.telegram_chat_id : '••••••••••••'}`
                      : 'Vincula tu Telegram para recibir avisos cuando el stock caiga a ≤ 10 un.'}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={isConectado ? 'CONECTADO' : 'INACTIVO'}
                  size="small"
                  sx={{
                    backgroundColor: isConectado ? '#C8E6C9' : '#E8E1DA',
                    color: isConectado ? '#1B5E20' : '#78665B',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                  }}
                />

                {isConectado && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setConfirmUnlinkOpen(true)}
                    disabled={saving}
                    sx={{
                      borderColor: '#EF9A9A',
                      color: '#C62828',
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      py: 0.3,
                      px: 1.2,
                      minHeight: 28,
                      '&:hover': {
                        backgroundColor: '#FFEBEE',
                        borderColor: '#D32F2F',
                      },
                    }}
                  >
                    Desvincular Chat
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Mensajes de Feedback */}
            {feedback.message && (
              <Alert
                severity={feedback.type || 'info'}
                variant={feedback.type === 'success' ? 'filled' : 'standard'}
                sx={{
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  boxShadow: feedback.type === 'success' ? '0 4px 12px rgba(46, 125, 50, 0.25)' : 'none',
                }}
                onClose={() => setFeedback({ type: '', message: '' })}
              >
                {feedback.message}
              </Alert>
            )}

            {/* Instrucciones de Uso (Solo visibles si NO está vinculado) */}
            {!isConectado && (
              <Box sx={{ backgroundColor: '#F8F6F4', p: 2, borderRadius: '12px', border: '1px solid #EFEAE6' }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#5C4535', display: 'block', mb: 0.8 }}>
                  ¿Cómo obtener tu Telegram Chat ID?
                </Typography>
                <Typography variant="caption" sx={{ color: '#78665B', display: 'block', lineHeight: 1.6 }}>
                  1. En el chat con el bot de Telegram, envía el comando <b>/estado</b> o <b>/start</b>.<br />
                  2. El bot te responderá con tu identificador numérico confidencial.<br />
                  3. Copia el número, pégalo en el campo inferior y presiona <b>Guardar Vinculación</b>.<br />
                  <i>(Nota: El código se almacena encriptado y protegido para uso exclusivo de tu cuenta).</i>
                </Typography>
              </Box>
            )}

            {/* Datos de la Vinculación Activa (Solo visible cuando está vinculado) */}
            {isConectado && (
              <Box
                sx={{
                  backgroundColor: '#FAF7F5',
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid #EAE3DC',
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  sx={{ color: '#4A3728', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CheckCircleOutlinedIcon sx={{ color: '#2E7D32', fontSize: 18 }} />
                  Datos de la Vinculación
                </Typography>

                <Stack spacing={1.2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Dueño Autorizado:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#4A3728', fontWeight: 700 }}>
                      {currentUser?.nombre ? `${currentUser.nombre} ${currentUser.apellido || ''}`.trim() : 'Dueño de Cafetería'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Cafetería Asignada:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#4A3728', fontWeight: 700 }}>
                      {configActual?.cafeterias?.nombre || 'Cafetería Central'} (ID #{configActual?.cafeteria_id || cafeteriaId})
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Chat ID Protegido:
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          color: '#2E7D32',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          letterSpacing: showChatId ? '0.5px' : '2px',
                          backgroundColor: '#E8F5E9',
                          px: 1,
                          py: 0.3,
                          borderRadius: '6px',
                        }}
                      >
                        {showChatId ? configActual?.telegram_chat_id : '••••••••••••'}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setShowChatId(!showChatId)}
                        sx={{ color: '#78665B', p: 0.5 }}
                        title={showChatId ? 'Ocultar Chat ID' : 'Mostrar Chat ID'}
                      >
                        {showChatId ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Alertas de Stock Crítico:
                    </Typography>
                    <Chip
                      label={notificacionesActivas ? 'ACTIVADAS (≤ 10 un.)' : 'PAUSADAS'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        backgroundColor: notificacionesActivas ? '#E8F5E9' : '#FFF3E0',
                        color: notificacionesActivas ? '#2E7D32' : '#E65100',
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
                      Nivel de Seguridad:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#2E7D32', fontWeight: 700 }}>
                      🔒 Canal Privado Dueño
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* Campo de Entrada de Chat ID */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#5C4535' }}>
                  {isConectado ? 'Modificar Telegram Chat ID *' : 'Telegram Chat ID del Dueño *'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#8C7A6F', fontSize: '0.72rem' }}>
                  🔒 Protegido como contraseña
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                type={showChatId ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowChatId(!showChatId)}
                        edge="end"
                        sx={{ color: '#8C7A6F' }}
                        title={showChatId ? 'Ocultar código' : 'Mostrar código'}
                      >
                        {showChatId ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    backgroundColor: '#FAF7F5',
                    fontSize: '0.88rem',
                    letterSpacing: showChatId ? '0px' : '2px',
                    '& fieldset': { borderColor: '#E8E1DA' },
                    '&:hover fieldset': { borderColor: '#C8B2A1' },
                    '&.Mui-focused fieldset': { borderColor: '#C86237' },
                  },
                }}
              />
            </Box>

            {/* Switch de activación de alertas de stock */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                border: '1px solid #EFEAE6',
                backgroundColor: '#FAF7F5',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={notificacionesActivas}
                    onChange={(e) => setNotificacionesActivas(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#4A3728' }}>
                      Alertas de Stock Crítico (≤ 10 un.)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block' }}>
                      Despachar notificación instantánea cuando un producto alcance nivel crítico.
                    </Typography>
                  </Box>
                }
              />
            </Box>



            <Divider sx={{ borderColor: '#EFEAE6' }} />

            {/* Acciones del Modal */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
              <Stack direction="row" spacing={1.2}>
                {isConectado && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SendOutlinedIcon />}
                    onClick={handleTest}
                    disabled={testing || saving}
                    sx={{
                      borderColor: '#C8B2A1',
                      color: '#4A3728',
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: '#4A3728',
                        backgroundColor: '#FAF7F4',
                      },
                    }}
                  >
                    {testing ? 'Enviando...' : 'Enviar Prueba'}
                  </Button>
                )}

                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSave}
                  disabled={saving}
                  sx={{
                    backgroundColor: '#C86237',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.5,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: '#B2522B',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {saving ? 'Guardando...' : (isConectado ? 'Guardar Cambios' : 'Guardar Vinculación')}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      {/* Diálogo de Confirmación para Desvincular */}
      <Dialog
        open={confirmUnlinkOpen}
        onClose={() => setConfirmUnlinkOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
            maxWidth: 420,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#C62828', pb: 1 }}>
          ¿Desvincular Chat de Telegram?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#5C4535', lineHeight: 1.6 }}>
            ¿Confirmas que deseas desvincular el Chat ID <b>{showChatId ? configActual?.telegram_chat_id : '••••••••••••'}</b> de tu cuenta de Dueño?
            <br />
            Tu teléfono dejará de recibir alertas automáticas cuando el stock de los productos sea crítico.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmUnlinkOpen(false)}
            sx={{ color: '#78665B', textTransform: 'none', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmUnlinkOpen(false);
              handleDesvincular();
            }}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
            }}
          >
            Sí, Desvincular
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default TelegramConfigModal;
