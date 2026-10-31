import { Box, Button, InputAdornment, TextField, Tooltip, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

import Clock from './Clock';
import ConnectionBadge from './ConnectionBadge';
import { VOZ_ACTIVA, VOZ_SILENCIADA } from '../services/vozKdsService';
import { kdsColors } from '../theme/theme';

// T16 · Avisos de voz del KDS.
// El botón cumple dos funciones distintas según el estado:
//   - apagada  -> "Activar avisos" (es el clic que desbloquea el
//                 audio, requisito de los navegadores).
//   - activa / silenciada -> alterna el silencio.
function BotonVoz({ estado, onActivar, onSilenciar }) {
  const activa = estado === VOZ_ACTIVA;
  const silenciada = estado === VOZ_SILENCIADA;

  const texto = activa
    ? 'Silenciar avisos de voz'
    : silenciada
      ? 'Volver a activar los avisos de voz'
      : 'Activar avisos de voz (un clic es necesario para que el navegador permita el sonido)';

  const onClick = activa ? onSilenciar : onActivar;

  const color = activa ? '#2E7D32' : silenciada ? '#6D4C41' : kdsColors.accent;
  const colorHover = activa ? '#27662B' : silenciada ? '#5D4037' : kdsColors.accentHover;

  return (
    <Tooltip title={texto}>
      <span>
        <Button
          onClick={onClick}
          startIcon={activa ? <VolumeUpIcon /> : <VolumeOffIcon />}
          sx={{
            backgroundColor: color,
            color: kdsColors.onDark,
            minHeight: 44,
            fontWeight: 800,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { backgroundColor: colorHover },
          }}
        >
          {activa ? 'Voz on' : silenciada ? 'Voz off' : 'Activar voz'}
        </Button>
      </span>
    </Tooltip>
  );
}

function KdsTopBar({ conexion = 'conectado', onEscanear, estadoVoz, onActivarVoz, onSilenciarVoz, avisoVoz, busqueda = '', onBusquedaChange }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { xs: 1.5, md: 2 },
        backgroundColor: kdsColors.header,
        borderRadius: 2,
        px: { xs: 2, md: 3 },
        py: 1.5,
        minHeight: 72,
        flexShrink: 0,
      }}
    >
      {/* Identidad + aviso: ocupa el espacio flexible y trunca si hace falta */}
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '0 1 auto' }}>
        <Typography
          variant="h4"
          fontWeight={800}
          noWrap
          sx={{
            color: kdsColors.onDark,
            fontSize: { xs: '1.4rem', sm: '1.7rem', md: '1.9rem' },
            lineHeight: 1.2,
          }}
        >
          CoffeeFast - KDS Cocina Central
        </Typography>
        {avisoVoz && (
          <Typography noWrap sx={{ color: kdsColors.onDarkMuted, fontSize: 12, mt: 0.25 }}>
            {avisoVoz}
          </Typography>
        )}
      </Box>

      {/* Búsqueda local por código/identificador visible */}
      <Box sx={{ flex: '1 1 280px', maxWidth: 420, minWidth: 180 }}>
        <TextField
          fullWidth
          size="small"
          value={busqueda}
          onChange={(e) => onBusquedaChange?.(e.target.value)}
          placeholder="Buscar por código de pedido..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: kdsColors.textSecondary }} />
              </InputAdornment>
            ),
            sx: {
              backgroundColor: '#fff',
              borderRadius: 2,
              color: kdsColors.textPrimary,
            },
          }}
          inputProps={{
            style: {
              color: kdsColors.textPrimary,
            },
          }}
        />
      </Box>

      {/* Acciones: no se encogen y quedan siempre alineadas a la derecha */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, flexShrink: 0 }}>
        {onEscanear && (
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={onEscanear}
            sx={{
              backgroundColor: kdsColors.accent,
              minHeight: 44,
              fontWeight: 800,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { backgroundColor: kdsColors.accentHover },
            }}
          >
            Escanear QR
          </Button>
        )}
        {(onActivarVoz || onSilenciarVoz) && (
          <BotonVoz estado={estadoVoz} onActivar={onActivarVoz} onSilenciar={onSilenciarVoz} />
        )}
        <ConnectionBadge estado={conexion} />
        <Clock />
      </Box>
    </Box>
  );
}

export default KdsTopBar;
