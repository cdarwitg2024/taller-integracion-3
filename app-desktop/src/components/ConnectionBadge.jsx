import { Box, Typography } from '@mui/material';

const CONFIG = {
  conectado: { color: '#2E7D32', label: 'Conectado', pulso: 'rgba(46, 125, 50, 0.7)' },
  reconectando: { color: '#E65100', label: 'Reconectando…', pulso: 'rgba(230, 81, 0, 0.7)' },
  indisponible: { color: '#78665B', label: 'Sin Realtime', pulso: 'rgba(120, 102, 91, 0.7)' },
};

function ConnectionBadge({ estado = 'conectado', label: labelProp }) {
  const cfg = CONFIG[estado] || CONFIG.conectado;
  const label = labelProp || cfg.label;

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
          backgroundColor: cfg.color,
          boxShadow: `0 0 0 0 ${cfg.pulso}`,
          animation: 'kds-pulse-dot 1.8s ease-out infinite',
          '@keyframes kds-pulse-dot': {
            '0%': { boxShadow: `0 0 0 0 ${cfg.pulso}` },
            '70%': { boxShadow: `0 0 0 8px rgba(0, 0, 0, 0)` },
            '100%': { boxShadow: `0 0 0 0 rgba(0, 0, 0, 0)` },
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