import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

function RoleSelector({ onSelectRole }) {
  const navigate = useNavigate();

  const handleSelect = (role) => {
    if (onSelectRole) onSelectRole(role);
    if (role === 'dueno') {
      navigate('/login/dueno');
    } else {
      navigate('/login/empleado');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#F5F2EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 920,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Cabecera / Marca */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 5 } }}>
          <Typography
            variant="h3"
            fontWeight={800}
            sx={{
              color: '#433225',
              letterSpacing: '-0.5px',
              fontFamily: '"Playfair Display", serif',
            }}
          >
            CoffeeFaster
          </Typography>
        </Box>

        {/* Tarjetas de Selección de Rol */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3.5,
            width: '100%',
          }}
        >
          {/* Opción 1: Dueño */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '24px',
              border: '1.5px solid #EAE2D8',
              backgroundColor: '#FFFFFF',
              p: { xs: 3.5, md: 4.5 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(67, 50, 37, 0.08)',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 40px rgba(67, 50, 37, 0.14)',
                borderColor: '#C8B2A1',
              },
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: '16px',
                    backgroundColor: '#FAF2EC',
                    color: '#433225',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StorefrontOutlinedIcon sx={{ fontSize: 32 }} />
                </Box>
                <Chip
                  label="ADMINISTRACIÓN"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    backgroundColor: '#FAF7F5',
                    color: '#8C7A6F',
                    border: '1px solid #EAE2D8',
                    letterSpacing: '0.5px',
                  }}
                />
              </Box>

              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ color: '#3E2D22', mb: 1, fontSize: '1.35rem' }}
              >
                Portal Dueño
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#78665B', lineHeight: 1.6, mb: 4, fontSize: '0.88rem' }}
              >
                Acceso completo al panel administrativo. Gestiona el catálogo de productos, monitorea el stock e inventario y analiza las métricas de tu negocio.
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => handleSelect('dueno')}
              sx={{
                py: 1.3,
                borderRadius: '12px',
                backgroundColor: '#433225',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.92rem',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#2F231A',
                  boxShadow: 'none',
                },
              }}
            >
              Ingresar como Dueño
            </Button>
          </Paper>

          {/* Opción 2: Empleado */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '24px',
              border: '1.5px solid #EAE2D8',
              backgroundColor: '#FFFFFF',
              p: { xs: 3.5, md: 4.5 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(67, 50, 37, 0.08)',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 40px rgba(200, 98, 55, 0.16)',
                borderColor: '#C86237',
              },
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: '16px',
                    backgroundColor: '#FCEFEA',
                    color: '#C86237',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ReceiptLongOutlinedIcon sx={{ fontSize: 32 }} />
                </Box>
                <Chip
                  label="COCINA & KDS"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    backgroundColor: '#FAF7F5',
                    color: '#C86237',
                    border: '1px solid #F2DDD4',
                    letterSpacing: '0.5px',
                  }}
                />
              </Box>

              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ color: '#3E2D22', mb: 1, fontSize: '1.35rem' }}
              >
                Portal Empleado
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#78665B', lineHeight: 1.6, mb: 4, fontSize: '0.88rem' }}
              >
                Terminal de comandas en tiempo real. Visualiza los pedidos entrantes, avanza los estados de preparación en cocina y realiza la entrega ágil a los clientes.
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => handleSelect('empleado')}
              sx={{
                py: 1.3,
                borderRadius: '12px',
                backgroundColor: '#C86237',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.92rem',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#B2522B',
                  boxShadow: 'none',
                },
              }}
            >
              Ingresar como Empleado
            </Button>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default RoleSelector;
