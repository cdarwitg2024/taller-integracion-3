import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
  InputAdornment,
  Link,
} from '@mui/material';

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

function Login({ onLogin }) {
  const [email, setEmail] = useState('dueno@coffeefaster.cl');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin) {
      onLogin();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#F5F2EB', // Fondo cálido suave según el diseño
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      {/* Tarjeta central dividida en dos paneles (Estilo Login Dueño) */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 780,
          minHeight: 440,
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          boxShadow: '0 16px 48px rgba(67, 50, 37, 0.12)',
          border: '1px solid #EAE2D8',
        }}
      >
        {/* Panel Izquierdo: Café Oscuro con Marca y Bienvenida */}
        <Box
          sx={{
            flex: { xs: 'none', md: '0 0 42%' },
            backgroundColor: '#433225', // Fondo café oscuro
            color: '#FFFFFF',
            p: { xs: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                letterSpacing: '-0.5px',
                color: '#FFFFFF',
                mb: 2.5,
              }}
            >
              CoffeeFaster
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: '#D5C7BC',
                lineHeight: 1.65,
                fontSize: '0.88rem',
              }}
            >
              Bienvenido al Panel de Administración. Controla tus catálogos, gestiona el inventario y monitorea las métricas de tu cafetería en un solo lugar.
            </Typography>
          </Box>

          <Box sx={{ mt: { xs: 4, md: 0 } }}>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.45)',
                fontSize: '0.72rem',
                display: 'block',
              }}
            >
              Panel exclusivo para dueños y administradores
            </Typography>
          </Box>
        </Box>

        {/* Panel Derecho: Formulario Blanco de Inicio de Sesión */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            p: { xs: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="h6"
            fontWeight={800}
            sx={{
              color: '#3E2D22',
              mb: 3,
              fontSize: '1.3rem',
            }}
          >
            Iniciar Sesión
          </Typography>

          <Stack spacing={2.5}>
            {/* Campo Correo o Teléfono */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  color: '#8C7A6F',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  display: 'block',
                  mb: 0.8,
                }}
              >
                Correo o número de teléfono
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="ejemplo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    backgroundColor: '#FAF7F5',
                    fontSize: '0.88rem',
                    '& fieldset': {
                      borderColor: '#E8E1DA',
                    },
                    '&:hover fieldset': {
                      borderColor: '#C8B2A1',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#4A3728',
                    },
                  },
                }}
              />
            </Box>

            {/* Campo Contraseña */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  color: '#8C7A6F',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  display: 'block',
                  mb: 0.8,
                }}
              >
                Contraseña
              </Typography>
              <TextField
                size="small"
                fullWidth
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: '#8C7A6F' }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    backgroundColor: '#FAF7F5',
                    fontSize: '0.88rem',
                    '& fieldset': {
                      borderColor: '#E8E1DA',
                    },
                    '&:hover fieldset': {
                      borderColor: '#C8B2A1',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#4A3728',
                    },
                  },
                }}
              />
            </Box>

            {/* Olvidaste tu contraseña */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
              <Link
                href="#"
                underline="hover"
                onClick={(e) => e.preventDefault()}
                sx={{
                  color: '#C86237',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </Box>

            {/* Botón Ingresar al Panel */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '10px',
                backgroundColor: '#C86237', // Tono naranja terracota del prototipo
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
              Ingresar al Panel
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
