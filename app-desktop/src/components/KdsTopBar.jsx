import { Box, Typography } from '@mui/material';

import Clock from './Clock';
import ConnectionBadge from './ConnectionBadge';

function KdsTopBar({ conexion = 'conectado' }) {
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
        <ConnectionBadge estado={conexion} />
        <Clock />
      </Box>
    </Box>
  );
}

export default KdsTopBar;