import { Box, Typography, Button, Stack, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * PageHeader — Encabezado consistente para las páginas del panel Dueño.
 *
 * Props:
 * - title: Título principal de la página (h4).
 * - subtitle: Texto de apoyo (body2).
 * - actions: Elementos JSX opcionales a la derecha (botones personalizados).
 * - onRefresh: Función para el botón de actualizar.
 * - loading: Estado de carga para deshabilitar el botón de actualizar.
 */
function PageHeader({ title, subtitle, actions, onRefresh, loading }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3,
        width: '100%',
      }}
    >
      <Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{ color: 'text.primary', letterSpacing: '-0.5px' }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        {onRefresh && (
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
            {loading ? 'Actualizando...' : 'Actualizar'}
          </Button>
        )}
        {actions}
      </Stack>
    </Box>
  );
}

export default PageHeader;
