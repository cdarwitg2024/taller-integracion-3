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

import { useNavigate } from 'react-router-dom';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { usuarios } from '../../service/usuarios';

function LoginEmpleado({ onLogin, onBack }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(import.meta.env?.VITE_DEV_EMPLEADO_EMAIL || 'empleado@coffeefaster.cl');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleBack = () => {
    if (onBack) onBack();
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await usuarios.loginEmpleado(email, password);
      if (res.success) {
        if (onLogin) onLogin(res.user);
      } else {
        setErrorMsg(res.error || 'Credenciales inválidas.');
      }
    } catch (err) {
      console.error('Error en login de empleado:', err);
      setErrorMsg('Error de conexión con el servicio de autenticación.');
    } finally {
      setLoading(false);
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
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 820,
          minHeight: 460,
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          boxShadow: '0 16px 48px rgba(67, 50, 37, 0.12)',
          border: '1px solid #EAE2D8',
        }}
      >
        {/* Panel Izquierdo: Café Oscuro con Marca y Orientación a Cocina/KDS */}
        <Box
          sx={{
            flex: { xs: 'none', md: '0 0 42%' },
            backgroundColor: '#433225',
            color: '#FFFFFF',
            p: { xs: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(200, 98, 55, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFA07A',
                }}
              >
                <ReceiptLongOutlinedIcon fontSize="small" />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#D5C7BC',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  fontSize: '0.72rem',
                }}
              >
                Portal Empleado
              </Typography>
            </Box>

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
                mb: 3,
              }}
            >
              Terminal de Comandas (KDS). Gestiona pedidos entrantes en tiempo real, agiliza la preparación en barra y cocina, y atiende la entrega inmediata.
            </Typography>

            <Stack spacing={1.2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: '#C86237' }} />
                <Typography variant="caption" sx={{ color: '#E0D4CA', fontSize: '0.8rem' }}>
                  Flujo Kanban en tiempo real
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: '#C86237' }} />
                <Typography variant="caption" sx={{ color: '#E0D4CA', fontSize: '0.8rem' }}>
                  Actualización instantánea de comandas
                </Typography>
              </Box>
            </Stack>
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
              Terminal exclusivo para personal operativo y cocina
            </Typography>
          </Box>
        </Box>

        {/* Panel Derecho: Formulario de Inicio de Sesión de Empleado */}
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
            position: 'relative',
          }}
        >
          {/* Botón para volver a selección de rol */}
          <Button
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={handleBack}
            sx={{
              alignSelf: 'flex-start',
              mb: 2.5,
              px: 1.8,
              py: 0.8,
              borderRadius: '10px',
              backgroundColor: '#FAF7F5',
              border: '1px solid #EAE2D8',
              color: '#5B4A3E',
              fontSize: '0.84rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: '#F0EAE1',
                color: '#433225',
                borderColor: '#C8B2A1',
                transform: 'translateX(-2px)',
              },
            }}
          >
            Volver al menú principal
          </Button>

          <Typography
            variant="h6"
            fontWeight={800}
            sx={{
              color: '#3E2D22',
              mb: 0.5,
              fontSize: '1.3rem',
            }}
          >
            Iniciar Sesión
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#8C7A6F',
              mb: 3,
              display: 'block',
              fontSize: '0.82rem',
            }}
          >
            Ingresa con tu cuenta de empleado para acceder a las comandas
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
                placeholder="empleado@coffeefaster.cl"
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
                      borderColor: '#C86237',
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
                      borderColor: '#C86237',
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
                ¿Problemas para acceder?
              </Link>
            </Box>

            {errorMsg && (
              <Typography
                variant="caption"
                sx={{
                  color: '#D32F2F',
                  fontWeight: 600,
                  backgroundColor: '#FFEBEE',
                  p: 1,
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                {errorMsg}
              </Typography>
            )}

            {/* Botón Ingresar a Comandas */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '10px',
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
              {loading ? 'Verificando...' : 'Ingresar a Comandas'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default LoginEmpleado;
