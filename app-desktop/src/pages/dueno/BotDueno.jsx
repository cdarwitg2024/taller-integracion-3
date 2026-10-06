import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';

import TelegramIcon from '@mui/icons-material/Telegram';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

import BotChatInterface from '../../components/bot/BotChatInterface';
import TelegramConfigModal from '../../components/telegram/TelegramConfigModal';
import { botService } from '../../service/botService';
import { telegramDuenoService } from '../../service/telegram_dueno';

function BotDueno({ currentUser }) {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const duenoId = currentUser?.id || 1;
  const cafeteriaId = currentUser?.cafeteria_id || 1;

  const loadData = async () => {
    setLoadingHealth(true);
    try {
      const [health, tgConfig] = await Promise.all([
        botService.checkHealth(3500),
        telegramDuenoService.getConfiguracion(duenoId),
      ]);

      setServiceHealth(health);
      setTelegramConfig(tgConfig);
    } catch (err) {
      console.warn('Error cargando indicadores del bot:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [duenoId, cafeteriaId]);

  const isTgLinked = Boolean(telegramConfig?.telegram_chat_id);
  const isServiceOnline = Boolean(serviceHealth?.ok);
  // El bot solo se considera en línea si el servicio está activo Y está vinculado a Telegram
  const isConnected = isServiceOnline && isTgLinked;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. CABECERA DE LA PÁGINA */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', letterSpacing: '-0.5px' }}>
            Bot y Asistente del Dueño
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Consola interactiva del Bot CoffeeFaster, diagnóstico de servicio y ejecución de consultas de existencias en tiempo real.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={loadingHealth ? <CircularProgress size={14} color="inherit" /> : <RefreshOutlinedIcon />}
            onClick={loadData}
            disabled={loadingHealth}
            sx={{
              borderColor: '#D7CCC8',
              color: '#5D4037',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              py: 0.8,
              px: 1.8,
              '&:hover': {
                backgroundColor: '#FAF7F5',
                borderColor: '#A1887F',
              },
            }}
          >
            Actualizar Estado
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => setConfigModalOpen(true)}
            sx={{
              backgroundColor: '#433225',
              color: '#FFFFFF',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              py: 0.8,
              px: 2,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#2D231B',
                boxShadow: 'none',
              },
            }}
          >
            Vincular Telegram
          </Button>
        </Stack>
      </Box>

      {/* 2. TARJETAS DE ESTADO Y VINCULACIÓN COMPACTAS */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        {/* KPI 1: Estado del servicio Bot (Conexión) */}
        <Paper
          elevation={0}
          sx={{
            py: 1.2,
            px: 2,
            borderRadius: '12px',
            backgroundColor: isConnected ? '#F4F9F4' : '#FEF2F2',
            border: `1px solid ${isConnected ? '#C8E6C9' : '#FECACA'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2.5,
            minWidth: 200,
            boxShadow: '0 1px 4px rgba(67, 50, 37, 0.04)',
          }}
        >
          <Box>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                color: isConnected ? '#2E7D32' : '#C62828',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.66rem',
                display: 'block',
              }}
            >
              Estado de la Conexión
            </Typography>
            <Typography
              fontWeight={800}
              sx={{
                color: isConnected ? '#1B5E20' : '#B71C1C',
                fontSize: '1.05rem',
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              {loadingHealth ? 'Comprobando...' : isConnected ? 'En Línea' : 'Apagado'}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: isConnected ? '#E8F5E9' : '#FEE2E2',
              color: isConnected ? '#2E7D32' : '#C62828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isConnected ? (
              <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
            ) : (
              <ErrorOutlineOutlinedIcon sx={{ fontSize: 18 }} />
            )}
          </Box>
        </Paper>

        {/* KPI 2: Vinculación Telegram */}
        <Paper
          elevation={0}
          sx={{
            py: 1.2,
            px: 2,
            borderRadius: '12px',
            backgroundColor: isTgLinked ? '#F0F9FF' : '#FFFBEB',
            border: `1px solid ${isTgLinked ? '#BAE6FD' : '#FDE68A'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2.5,
            minWidth: 200,
            boxShadow: '0 1px 4px rgba(67, 50, 37, 0.04)',
          }}
        >
          <Box>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                color: isTgLinked ? '#0284C7' : '#D97706',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.66rem',
                display: 'block',
              }}
            >
              Telegram Dueño
            </Typography>
            <Typography
              fontWeight={800}
              sx={{
                color: isTgLinked ? '#0369A1' : '#B45309',
                fontSize: '1.05rem',
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              {isTgLinked ? 'Vinculado' : 'Sin Vincular'}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: isTgLinked ? '#E0F2FE' : '#FEF3C7',
              color: isTgLinked ? '#0284C7' : '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TelegramIcon sx={{ fontSize: 18 }} />
          </Box>
        </Paper>
      </Box>

      {/* 3. INTERFAZ INTERACTIVA DEL BOT */}
      <BotChatInterface
        currentUser={currentUser}
        serviceHealth={serviceHealth}
        telegramConfig={telegramConfig}
      />

      {/* 4. MODAL DE CONFIGURACIÓN DE TELEGRAM */}
      <TelegramConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        currentUser={currentUser}
        onConfigUpdated={(cfg) => {
          setTelegramConfig(cfg);
          loadData();
        }}
      />
    </Box>
  );
}

export default BotDueno;
