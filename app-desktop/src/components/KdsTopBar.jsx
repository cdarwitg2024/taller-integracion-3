import { Box, Button, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import Clock from './Clock';
import ConnectionBadge from './ConnectionBadge';

function KdsTopBar({ conexion = 'conectado', onEscanear }) {
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
        <ConnectionBadge estado={conexion} />
        <Clock />
      </Box>
    </Box>
  );
}

export default KdsTopBar;