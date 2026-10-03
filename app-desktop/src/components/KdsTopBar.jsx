import { Box, Button, Tooltip, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

import Clock from './Clock';
import ConnectionBadge from './ConnectionBadge';
import { VOZ_ACTIVA, VOZ_SILENCIADA } from '../services/vozKdsService';

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

  const color = activa ? '#2E7D32' : silenciada ? '#6D4C41' : '#C86237';
  const colorHover = activa ? '#27662B' : silenciada ? '#5D4037' : '#B2522B';

  return (
    <Tooltip title={texto}>
      <span>
        <Button
          onClick={onClick}
          startIcon={activa ? <VolumeUpIcon /> : <VolumeOffIcon />}
          sx={{
            backgroundColor: color,
            color: '#FFFFFF',
            minHeight: 44,
            fontWeight: 800,
            textTransform: 'none',
            '&:hover': { backgroundColor: colorHover },
          }}
        >
          {activa ? 'Voz on' : silenciada ? 'Voz off' : 'Activar voz'}
        </Button>
      </span>
    </Tooltip>
  );
}

function KdsTopBar({ conexion = 'conectado', onEscanear, estadoVoz, onActivarVoz, onSilenciarVoz, avisoVoz }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        backgroundColor: '#4A3B32',
        borderRadius: 2,
        px: 3,
        py: 2,
        minHeight: 72,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          CoffeeFast - KDS Cocina Central
        </Typography>
        {avisoVoz && (
          <Typography sx={{ color: '#E8D5C4', fontSize: 12, mt: 0.5 }}>
            {avisoVoz}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        {onEscanear && (
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={onEscanear}
            sx={{
              backgroundColor: '#C86237',
              minHeight: 44,
              fontWeight: 800,
              textTransform: 'none',
              '&:hover': { backgroundColor: '#B2522B' },
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
