import { Box, Typography, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

function DashboardHeader({ onRefresh, loading }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3.5,
        width: '100%',
      }}
    >
      <Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{ color: '#4A3728', letterSpacing: '-0.5px' }}
        >
          Dashboard Central
        </Typography>
        <Typography variant="body2" sx={{ color: '#78665B', mt: 0.5 }}>
          Métricas en tiempo real, pedidos activos y rendimiento de ventas de la cafetería.
        </Typography>
      </Box>

      <Button
        variant="contained"
        startIcon={<RefreshIcon />}
        onClick={onRefresh}
        disabled={loading}
        sx={{
          backgroundColor: '#4A3728',
          color: '#FFFFFF',
          borderRadius: '10px',
          textTransform: 'none',
          px: 2.5,
          py: 1.1,
          fontWeight: 600,
          boxShadow: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: '#38281E',
            boxShadow: '0 4px 12px rgba(74, 55, 40, 0.2)',
          },
        }}
      >
        {loading ? 'Actualizando...' : 'Actualizar Datos'}
      </Button>
    </Box>
  );
}

export default DashboardHeader;
