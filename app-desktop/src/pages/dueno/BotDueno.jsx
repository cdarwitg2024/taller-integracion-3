import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';

import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

import BotChatInterface from '../../components/bot/BotChatInterface';
import TelegramConfigModal from '../../components/telegram/TelegramConfigModal';
import { botService } from '../../service/botService';
import { telegramDuenoService } from '../../service/telegram_dueno';
import { alertasStock } from '../../service/alertas_stock';

function BotDueno({ currentUser }) {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [criticosCount, setCriticosCount] = useState(0);

  const duenoId = currentUser?.id || 1;
  const cafeteriaId = currentUser?.cafeteria_id || 1;

  const loadData = async () => {
    setLoadingHealth(true);
    try {
      const [health, tgConfig, prods, alerts] = await Promise.all([
        botService.checkHealth(3500),
        telegramDuenoService.getConfiguracion(duenoId),
        botService.getProductosCafeteria(cafeteriaId),
        alertasStock.getByCafeteria(cafeteriaId).catch(() => []),
      ]);

      setServiceHealth(health);
      setTelegramConfig(tgConfig);
      setTotalAlertas(Array.isArray(alerts) ? alerts.length : 0);

      const criticos = prods.filter((p) => p.stock <= Math.max(p.stock_minimo, 10));
      setCriticosCount(criticos.length);
    } catch (err) {
      console.warn('Error cargando indicadores del bot:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [duenoId, cafeteriaId]);

  const isConnected = Boolean(serviceHealth?.ok);
  const isTgLinked = Boolean(telegramConfig?.telegram_chat_id);

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
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h4" fontWeight={800} sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}>
              Bot y Asistente del Dueño
            </Typography>
            <Chip
              label="Módulo Activo"
              size="small"
              sx={{
                backgroundColor: '#EFEBE9',
                color: '#5D4037',
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: '#8C7A6F', mt: 0.5 }}>
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

      {/* 2. TARJETAS DE INDICADORES / DIAGNÓSTICO */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* KPI 1: Estado del servicio Bot */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '14px',
              backgroundColor: isConnected ? '#F1F8E9' : '#FFEBEE',
              border: `1px solid ${isConnected ? '#C8E6C9' : '#FFCDD2'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: isConnected ? '#2E7D32' : '#C62828', textTransform: 'uppercase' }}>
                Servicio Bot (FastAPI)
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: isConnected ? '#1B5E20' : '#B71C1C', mt: 0.2 }}>
                {loadingHealth ? 'Comprobando...' : isConnected ? 'En Línea' : 'Desconectado'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', fontSize: '0.7rem' }}>
                Puerto 8000 • Webhook
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                backgroundColor: isConnected ? '#E8F5E9' : '#FFCDD2',
                color: isConnected ? '#2E7D32' : '#C62828',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isConnected ? <CheckCircleOutlinedIcon /> : <ErrorOutlineOutlinedIcon />}
            </Box>
          </Paper>
        </Grid>

        {/* KPI 2: Vinculación Telegram */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '14px',
              backgroundColor: isTgLinked ? '#E0F2FE' : '#FFFBEB',
              border: `1px solid ${isTgLinked ? '#BAE6FD' : '#FDE68A'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: isTgLinked ? '#0284C7' : '#D97706', textTransform: 'uppercase' }}>
                Telegram Dueño
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: isTgLinked ? '#0369A1' : '#B45309', mt: 0.2 }}>
                {isTgLinked ? 'Vinculado' : 'Sin Vincular'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', fontSize: '0.7rem' }}>
                {isTgLinked ? `Chat ID: ${telegramConfig.telegram_chat_id}` : 'Alertas desactivadas'}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                backgroundColor: isTgLinked ? '#BAE6FD' : '#FEF3C7',
                color: isTgLinked ? '#0284C7' : '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TelegramIcon />
            </Box>
          </Paper>
        </Grid>

        {/* KPI 3: Insumos críticos monitoreados */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '14px',
              backgroundColor: criticosCount > 0 ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${criticosCount > 0 ? '#FECACA' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: criticosCount > 0 ? '#DC2626' : '#16A34A', textTransform: 'uppercase' }}>
                Insumos en Alerta
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: criticosCount > 0 ? '#991B1B' : '#166534', mt: 0.2 }}>
                {criticosCount} productos
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', fontSize: '0.7rem' }}>
                Stock crítico o agotado (≤ 10 un.)
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                backgroundColor: criticosCount > 0 ? '#FEE2E2' : '#DCFCE7',
                color: criticosCount > 0 ? '#DC2626' : '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WarningAmberOutlinedIcon />
            </Box>
          </Paper>
        </Grid>

        {/* KPI 4: Historial de alertas emitidas */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '14px',
              backgroundColor: '#FAF5FF',
              border: '1px solid #E9D5FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#7C3AED', textTransform: 'uppercase' }}>
                Alertas Emitidas
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#581C87', mt: 0.2 }}>
                {totalAlertas} registros
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', fontSize: '0.7rem' }}>
                Disparadas por triggers de BD
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                backgroundColor: '#EDE9FE',
                color: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SmartToyOutlinedIcon />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 3. INTERFAZ INTERACTIVA DEL BOT */}
      <BotChatInterface
        currentUser={currentUser}
        onOpenConfigModal={() => setConfigModalOpen(true)}
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
