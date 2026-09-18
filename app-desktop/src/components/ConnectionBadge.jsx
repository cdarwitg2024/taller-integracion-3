import { Box, Typography } from '@mui/material';

function ConnectionBadge({ label = 'Conectado' }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.24)',
        borderRadius: 999,
        px: 2,
        py: 1,
        minHeight: 48,
      }}
    >
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#4ade80',
          boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.7)',
          animation: 'kds-pulse-dot 1.8s ease-out infinite',
          '@keyframes kds-pulse-dot': {
            '0%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.7)' },
            '70%': { boxShadow: '0 0 0 8px rgba(74, 222, 128, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' },
          },
        }}
      />
      <Typography
        fontWeight={700}
        sx={{ color: '#FFFFFF', whiteSpace: 'nowrap', letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default ConnectionBadge;