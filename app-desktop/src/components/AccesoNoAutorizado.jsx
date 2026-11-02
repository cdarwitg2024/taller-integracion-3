import { Box, Paper, Typography, Button } from '@mui/material';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';

// Pantalla de "acceso no autorizado": se muestra cuando la cuenta autenticada
// no tiene un rol válido asignado (ni dueño ni empleado) o no está autorizada
// para entrar al panel. Evita el bucle de redirección que ocurriría al
// redirigir a un usuario sin rol válido hacia un panel que no le corresponde,
// y le da una salida clara (cerrar sesión).
function AccesoNoAutorizado({ onLogout }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#F5F2EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 460,
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(67, 50, 37, 0.12)',
          border: '1px solid #EAE2D8',
        }}
      >
        <Box
          sx={{
            backgroundColor: '#433225',
            color: '#FFFFFF',
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              backgroundColor: 'rgba(200, 98, 55, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFA07A',
              mb: 2,
            }}
          >
            <BlockOutlinedIcon fontSize="medium" />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF' }}>
            Acceso no autorizado
          </Typography>
        </Box>

        <Box sx={{ backgroundColor: '#FFFFFF', p: 4 }}>
          <Typography
            variant="body2"
            sx={{ color: '#6B5A4E', lineHeight: 1.65, textAlign: 'center', mb: 3 }}
          >
            Tu cuenta no tiene un rol válido asignado para entrar al panel de
            CoffeeFast. Si crees que esto es un error, contacta al administrador
            del sistema.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={onLogout}
            startIcon={<LogoutRoundedIcon />}
            sx={{
              py: 1.2,
              borderRadius: '10px',
              backgroundColor: '#C86237',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9rem',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#B2522B', boxShadow: 'none' },
            }}
          >
            Cerrar sesión
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default AccesoNoAutorizado;
