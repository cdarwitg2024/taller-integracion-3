import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  InputAdornment,
  Chip,
  Paper,
  CircularProgress,
} from '@mui/material';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';

import { productos as productosService } from '../../service/productos';

/**
 * Diálogo para Modificar Precio (FR-46)
 * Operación separada e independiente para la gestión del precio del producto por el Dueño.
 * Muestra valores actuales, valida que el nuevo precio sea mayor a 0 y actualiza Supabase.
 */
function ModificarPrecioDialog({ open, onClose, producto, onSuccess }) {
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const precioActual = useMemo(() => {
    return Number(producto?.precio || 0);
  }, [producto]);

  // Inicializar el formulario al abrir con el producto seleccionado
  useEffect(() => {
    if (open && producto) {
      setNuevoPrecio(producto.precio !== undefined ? String(producto.precio) : '');
      setErrorMsg('');
    }
  }, [open, producto]);

  // Validación y cálculo de variación en tiempo real
  const parsedNuevoPrecio = Number(nuevoPrecio);
  const isInputEmpty = nuevoPrecio.trim() === '';
  const isNumeric = !isNaN(parsedNuevoPrecio) && !isInputEmpty;
  const isValido = isNumeric && parsedNuevoPrecio > 0;

  const variacion = useMemo(() => {
    if (!isValido || precioActual === 0) return null;
    const diff = parsedNuevoPrecio - precioActual;
    const porcentaje = ((diff / precioActual) * 100).toFixed(1);
    return { diff, porcentaje };
  }, [isValido, parsedNuevoPrecio, precioActual]);

  const handlePrecioChange = (e) => {
    const val = e.target.value;
    setNuevoPrecio(val);

    if (val.trim() === '') {
      setErrorMsg('El precio es obligatorio.');
    } else {
      const num = Number(val);
      if (isNaN(num)) {
        setErrorMsg('El precio debe ser un número válido.');
      } else if (num <= 0) {
        setErrorMsg('El precio debe ser un número mayor a 0.');
      } else {
        setErrorMsg('');
      }
    }
  };

  const handleGuardar = async () => {
    if (!producto) return;

    if (nuevoPrecio.trim() === '') {
      setErrorMsg('El precio es obligatorio.');
      return;
    }

    const precioFinal = Number(nuevoPrecio);
    if (isNaN(precioFinal) || precioFinal <= 0) {
      setErrorMsg('El precio debe ser un número mayor a 0.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      // Actualizar en Supabase mediante el servicio dedicado (FR-46)
      const productoActualizado = await productosService.updatePrecio(producto.id, precioFinal);

      if (onSuccess) {
        onSuccess(productoActualizado, `Precio de "${producto.nombre}" actualizado a $${precioFinal.toLocaleString('es-CL')}.`);
      }
      onClose();
    } catch (err) {
      console.error('Error al actualizar precio en Supabase:', err);
      setErrorMsg(err.message || 'Error al conectar con el servidor para actualizar el precio.');
    } finally {
      setSaving(false);
    }
  };

  if (!producto) return null;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      PaperProps={{
        sx: {
          borderRadius: '20px',
          p: 2,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 16px 40px rgba(74, 55, 40, 0.16)',
        },
      }}
    >
      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        {/* Cabecera del Diálogo */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              bgcolor: '#FAF2EA',
              color: '#C86237',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1.8,
            }}
          >
            <PriceChangeOutlinedIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22', lineHeight: 1.2 }}>
              Modificar Precio
            </Typography>
            <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
              Ajuste de Precio Unitario
            </Typography>
          </Box>
        </Box>

        {/* Sección: Valores Actuales */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: '14px',
            backgroundColor: '#FAF7F4',
            border: '1px solid #EFEAE6',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
            <Box sx={{ maxWidth: '65%' }}>
              <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600, display: 'block' }}>
                PRODUCTO
              </Typography>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#3E2D22', lineHeight: 1.2 }}>
                {producto.nombre}
              </Typography>
              <Typography variant="caption" sx={{ color: '#5C4535' }}>
                {producto.cafeteria_nombre || 'Cafetería Central'}
              </Typography>
            </Box>
            <Chip
              label={producto.categoria || 'GENERAL'}
              size="small"
              sx={{
                backgroundColor: producto.catBg || '#EFEBE9',
                color: producto.catColor || '#8D6E63',
                fontWeight: 700,
                fontSize: '0.68rem',
                borderRadius: '6px',
              }}
            />
          </Stack>

          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: '1px dashed #E8E1DA',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" sx={{ color: '#78665B', fontWeight: 600 }}>
              Precio Actual:
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#4A3728' }}>
              ${precioActual.toLocaleString('es-CL')} <Typography component="span" variant="caption" sx={{ color: '#8C7A6F' }}>CLP</Typography>
            </Typography>
          </Box>
        </Paper>

        {/* Formulario de Entrada del Nuevo Precio */}
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.8 }}>
              Nuevo Precio de Venta ($ CLP) *
            </Typography>
            <TextField
              size="small"
              fullWidth
              autoFocus
              type="number"
              placeholder="Ej. 2500"
              value={nuevoPrecio}
              onChange={handlePrecioChange}
              disabled={saving}
              error={Boolean(errorMsg)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ color: '#78665B', fontWeight: 700 }}>
                    $
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end" sx={{ color: '#8C7A6F', fontSize: '0.78rem' }}>
                    CLP
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '1rem',
                  '& fieldset': {
                    borderColor: '#D8CDC4',
                  },
                  '&:hover fieldset': {
                    borderColor: '#4A3728',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#C86237',
                  },
                },
              }}
            />
          </Box>

          {/* Comparativa / Variación respecto al precio actual */}
          {variacion && (
            <Paper
              elevation={0}
              sx={{
                p: 1.2,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: variacion.diff > 0 ? '#C8E6C9' : variacion.diff < 0 ? '#FFCDD2' : '#E0E0E0',
                backgroundColor: variacion.diff > 0 ? '#E8F5E9' : variacion.diff < 0 ? '#FFEBEE' : '#F5F5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {variacion.diff > 0 ? (
                  <TrendingUpIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                ) : variacion.diff < 0 ? (
                  <TrendingDownIcon sx={{ color: '#C62828', fontSize: 20 }} />
                ) : (
                  <RemoveIcon sx={{ color: '#757575', fontSize: 20 }} />
                )}
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    color: variacion.diff > 0 ? '#2E7D32' : variacion.diff < 0 ? '#C62828' : '#757575',
                  }}
                >
                  {variacion.diff > 0
                    ? `Aumento de $${variacion.diff.toLocaleString('es-CL')} (+${variacion.porcentaje}%)`
                    : variacion.diff < 0
                    ? `Descuento de $${Math.abs(variacion.diff).toLocaleString('es-CL')} (${variacion.porcentaje}%)`
                    : 'Sin variación respecto al precio actual'}
                </Typography>
              </Stack>
            </Paper>
          )}

          {/* Alerta de Error de Validación */}
          {errorMsg && (
            <Alert
              severity="error"
              sx={{
                borderRadius: '10px',
                fontSize: '0.8rem',
                py: 0.5,
              }}
            >
              {errorMsg}
            </Alert>
          )}

          {/* Botones de Acción */}
          <Stack direction="row" spacing={1.5} sx={{ pt: 1.5 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={saving}
              onClick={onClose}
              sx={{
                borderRadius: '24px',
                textTransform: 'none',
                borderColor: '#D0C4B8',
                color: '#6E5C50',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#9E8B7D',
                  backgroundColor: '#FAF6F2',
                },
              }}
            >
              Cancelar
            </Button>

            <Button
              variant="contained"
              fullWidth
              disabled={saving || !isValido}
              onClick={handleGuardar}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                borderRadius: '24px',
                textTransform: 'none',
                backgroundColor: '#C86237',
                color: '#FFFFFF',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#A04E2B',
                  boxShadow: 'none',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#E0D6CE',
                  color: '#A0948A',
                },
              }}
            >
              {saving ? 'Guardando...' : 'Actualizar Precio'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default ModificarPrecioDialog;
