import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';

import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

import { botService } from '../../service/botService';

const CONSULTAS_RAPIDAS = [
  {
    id: 'stock',
    comando: '/stock',
    label: 'Consultar Stock',
    icon: <Inventory2OutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  {
    id: 'stock_bajo',
    comando: '/stock_bajo',
    label: 'Stock Bajo',
    icon: <WarningAmberOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#D97706',
    bg: '#FEF3C7',
  },
  {
    id: 'agotados',
    comando: '/agotados',
    label: 'Productos Agotados',
    icon: <ErrorOutlineOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#DC2626',
    bg: '#FEE2E2',
  },
  {
    id: 'alertas',
    comando: '/alertas',
    label: 'Historial Alertas',
    icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
  {
    id: 'estado',
    comando: '/estado',
    label: 'Estado del Servicio',
    icon: <SpeedOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#0284C7',
    bg: '#E0F2FE',
  },
  {
    id: 'cafeteria',
    comando: '/cafeteria',
    label: 'Mi Cafetería',
    icon: <StorefrontOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#433225',
    bg: '#FAF7F5',
  },
  {
    id: 'test_alerta',
    comando: '/test_alerta',
    label: 'Probar Alerta',
    icon: <ScienceOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#C86237',
    bg: '#FFF3E0',
  },
  {
    id: 'ayuda',
    comando: '/ayuda',
    label: 'Ayuda',
    icon: <HelpOutlineOutlinedIcon sx={{ fontSize: 16 }} />,
    color: '#4B5563',
    bg: '#F3F4F6',
  },
];

function BotChatInterface({ currentUser, onOpenConfigModal }) {
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      texto: `👋 <b>¡Hola ${currentUser?.nombre || 'Dueño'}!</b>\n\n` +
        `Soy el <b>Asistente Virtual de CoffeeFaster</b>. Desde este panel puedes interactuar con el bot, ` +
        `comprobar la salud de los servicios, supervisar existencias críticas y probar consultas operativas en tiempo real.\n\n` +
        `💡 <i>Haz clic en los accesos rápidos superiores o escribe un comando abajo para comenzar.</i>`,
      tipo: 'bienvenida',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Verificar estado del servicio al montar
  const verificarConexion = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await botService.checkHealth(3500);
      setServiceStatus(res);
      if (!res.ok) {
        setConnectionError(res.error || 'No se pudo conectar con el servicio del Bot.');
      } else {
        setConnectionError(null);
      }
    } catch (err) {
      setServiceStatus({ ok: false, status: 'error', error: err.message, url: botService.getBaseUrl() });
      setConnectionError(err.message || 'Error de conexión.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    verificarConexion();
  }, []);

  const handleEnviarConsulta = async (cmdTexto) => {
    const textoFinal = (cmdTexto || inputVal).trim();
    if (!textoFinal || isProcessing) return;

    setInputVal('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mensaje de usuario en el chat
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      timestamp: timeStr,
      texto: textoFinal,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const resp = await botService.procesarConsulta(textoFinal, {
        usuarioId: currentUser?.id || 1,
        cafeteriaId: currentUser?.cafeteria_id || 1,
      });

      // Si la respuesta indica un fallo de conexión con el servicio
      if (!resp.ok && resp.isConnectionError) {
        setConnectionError(resp.texto || resp.error);
        setServiceStatus({ ok: false, status: 'disconnected', error: resp.error, url: botService.getBaseUrl() });
      } else if (resp.ok && resp.tipo === 'estado') {
        setConnectionError(null);
        setServiceStatus({ ok: true, status: 'healthy', data: resp.serviceStatus, url: botService.getBaseUrl() });
      }

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        texto: resp.texto,
        tipo: resp.tipo,
        isError: !resp.ok,
        isConnectionError: resp.isConnectionError || false,
        datos: resp.datos,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        texto: `❌ <b>Error inesperado:</b> ${err.message}`,
        isError: true,
        isConnectionError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarConsulta();
    }
  };

  const handleLimpiarChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        texto: `🧹 <i>Historial de conversación reiniciado.</i>\n\nPuedes ejecutar nuevas consultas básicas o diagnósticos del bot.`,
        tipo: 'info',
      },
    ]);
  };

  const isConectado = Boolean(serviceStatus?.ok);
  const botBaseUrl = botService.getBaseUrl();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 170px)',
        minHeight: 560,
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFEAE6',
        boxShadow: '0 8px 30px rgba(67, 50, 37, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* 1. BARRA SUPERIOR DE ESTADO Y CONECTIVIDAD */}
      <Box
        sx={{
          px: 3,
          py: 2,
          backgroundColor: '#FAF7F5',
          borderBottom: '1px solid #EFEAE6',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              backgroundColor: isConectado ? '#E8F5E9' : '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConectado ? '#2E7D32' : '#DC2626',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <SmartToyOutlinedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#4A3728', lineHeight: 1.2 }}>
                Interfaz del Bot CoffeeFaster
              </Typography>
              <Chip
                icon={
                  isCheckingHealth ? (
                    <CircularProgress size={12} color="inherit" />
                  ) : isConectado ? (
                    <WifiOutlinedIcon sx={{ fontSize: '14px !important' }} />
                  ) : (
                    <WifiOffOutlinedIcon sx={{ fontSize: '14px !important' }} />
                  )
                }
                label={isCheckingHealth ? 'Verificando...' : isConectado ? 'Servicio Conectado' : 'Servicio Desconectado'}
                size="small"
                sx={{
                  backgroundColor: isConectado ? '#C8E6C9' : '#FFCDD2',
                  color: isConectado ? '#1B5E20' : '#B71C1C',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  height: 24,
                }}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', mt: 0.2 }}>
              Servicio FastAPI: <code>{botBaseUrl}</code> • Panel de administración y consultas del dueño
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Comprobar conexión con el servicio del Bot">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  isCheckingHealth ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RefreshOutlinedIcon sx={{ fontSize: 16 }} />
                  )
                }
                onClick={verificarConexion}
                disabled={isCheckingHealth}
                sx={{
                  borderColor: '#E0D6CE',
                  color: '#5C4535',
                  borderRadius: '9px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  py: 0.6,
                  px: 1.4,
                  '&:hover': {
                    backgroundColor: '#F3EBE6',
                    borderColor: '#C8B6A6',
                  },
                }}
              >
                Comprobar Conexión
              </Button>
            </span>
          </Tooltip>

          {onOpenConfigModal && (
            <Tooltip title="Configurar Telegram Chat ID y Alertas">
              <Button
                variant="contained"
                size="small"
                startIcon={<TelegramIcon sx={{ fontSize: 18 }} />}
                onClick={onOpenConfigModal}
                sx={{
                  backgroundColor: '#0088CC',
                  color: '#FFFFFF',
                  borderRadius: '9px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 0.6,
                  px: 1.6,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#0077B5',
                    boxShadow: 'none',
                  },
                }}
              >
                Configurar Bot
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Limpiar historial">
            <IconButton size="small" onClick={handleLimpiarChat} sx={{ color: '#8C7A6F' }}>
              <DeleteOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* 2. ALERTA DE ERROR DE CONEXIÓN (SI CORRESPONDE) */}
      {connectionError && (
        <Alert
          severity="error"
          variant="filled"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={verificarConexion}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              Reintentar
            </Button>
          }
          sx={{
            borderRadius: 0,
            py: 0.8,
            px: 3,
            fontSize: '0.82rem',
            fontWeight: 600,
            backgroundColor: '#D32F2F',
            alignItems: 'center',
          }}
        >
          <b>Error de Conexión:</b> No se pudo conectar con el servicio del Bot en <code>{botBaseUrl}</code>.
          Asegúrate de que el servidor FastAPI esté iniciado (<code>python bot_server.py</code>).
        </Alert>
      )}

      {/* 3. BARRA DE ACCESOS RÁPIDOS (PROBAR CONSULTAS BÁSICAS) */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #F0EAE5',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: '#5C4535', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Consultas Básicas Rápidas:
          </Typography>
          <Typography variant="caption" sx={{ color: '#9C887C' }}>
            (Presiona un botón para probar la consulta directamente)
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {CONSULTAS_RAPIDAS.map((c) => (
            <Button
              key={c.id}
              variant="outlined"
              size="small"
              startIcon={c.icon}
              onClick={() => handleEnviarConsulta(c.comando)}
              disabled={isProcessing}
              sx={{
                borderColor: c.color + '40',
                backgroundColor: c.bg,
                color: c.color,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.75rem',
                py: 0.4,
                px: 1.2,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: c.bg,
                  borderColor: c.color,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                },
              }}
            >
              {c.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* 4. ÁREA DE MENSAJES Y RESPUESTAS DEL BOT */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 3,
          backgroundColor: '#FAF7F5',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          const isErr = m.isError || m.isConnectionError;

          return (
            <Box
              key={m.id}
              sx={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: 1.5,
              }}
            >
              {!isUser && (
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    backgroundColor: isErr ? '#FFEBEE' : '#433225',
                    color: isErr ? '#D32F2F' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(67, 50, 37, 0.15)',
                  }}
                >
                  {isErr ? <ErrorOutlineOutlinedIcon sx={{ fontSize: 22 }} /> : <SmartToyOutlinedIcon sx={{ fontSize: 22 }} />}
                </Box>
              )}

              <Box sx={{ maxWidth: { xs: '90%', sm: '80%', md: '75%' } }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    backgroundColor: isUser
                      ? '#433225'
                      : isErr
                      ? '#FFEBEE'
                      : '#FFFFFF',
                    color: isUser ? '#FFFFFF' : '#2D231B',
                    border: isUser
                      ? 'none'
                      : `1px solid ${isErr ? '#FFCDD2' : '#EFEAE6'}`,
                    boxShadow: isUser
                      ? '0 4px 12px rgba(67, 50, 37, 0.2)'
                      : '0 4px 12px rgba(67, 50, 37, 0.04)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 0.8,
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        color: isUser ? '#D0C0B4' : isErr ? '#C62828' : '#C86237',
                        textTransform: 'uppercase',
                        fontSize: '0.7rem',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {isUser ? 'Tú (Dueño)' : isErr ? 'Error de Servicio' : 'Bot CoffeeFaster'}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        color: isUser ? '#B39E8F' : '#9E8E82',
                        fontSize: '0.68rem',
                      }}
                    >
                      {m.timestamp}
                    </Typography>
                  </Box>

                  {/* Texto del mensaje (con soporte para HTML generado por bot) */}
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      '& b': { fontWeight: 700 },
                      '& code': {
                        backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : '#F5EFEB',
                        color: isUser ? '#FFFFFF' : '#433225',
                        px: 0.6,
                        py: 0.2,
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                      },
                    }}
                    dangerouslySetInnerHTML={{ __html: m.texto }}
                  />
                </Paper>
              </Box>

              {isUser && (
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    backgroundColor: '#C86237',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(200, 98, 55, 0.25)',
                  }}
                >
                  <PersonOutlinedIcon sx={{ fontSize: 22 }} />
                </Box>
              )}
            </Box>
          );
        })}

        {/* Indicador de consulta en progreso */}
        {isProcessing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 0.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                backgroundColor: '#433225',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SmartToyOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Paper
              elevation={0}
              sx={{
                py: 1.2,
                px: 2,
                borderRadius: '4px 16px 16px 16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #EFEAE6',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <CircularProgress size={16} sx={{ color: '#C86237' }} />
              <Typography variant="body2" sx={{ color: '#8C7A6F', fontSize: '0.82rem' }}>
                Consultando el servicio del bot y base de datos...
              </Typography>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* 5. ÁREA DE ENTRADA DE TEXTO Y ENVÍO */}
      <Box
        sx={{
          p: 2,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #EFEAE6',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Escribe un comando (/stock, /stock_bajo, /agotados, /alertas, /estado, /ayuda)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                backgroundColor: '#FAF7F5',
                fontSize: '0.88rem',
                '& fieldset': { borderColor: '#E8E1DA' },
                '&:hover fieldset': { borderColor: '#C8B2A1' },
                '&.Mui-focused fieldset': { borderColor: '#C86237' },
              },
            }}
          />

          <Button
            variant="contained"
            onClick={() => handleEnviarConsulta()}
            disabled={!inputVal.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <SendOutlinedIcon />}
            sx={{
              backgroundColor: '#C86237',
              color: '#FFFFFF',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              px: 2.8,
              py: 1,
              boxShadow: 'none',
              minWidth: 120,
              '&:hover': {
                backgroundColor: '#B2522B',
                boxShadow: 'none',
              },
            }}
          >
            {isProcessing ? 'Enviando' : 'Consultar'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default BotChatInterface;
