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
  IconButton,
  Tooltip,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

import { productos as productosService } from '../../service/productos';

/**
 * Diálogo para Modificar Stock (FR-47)
 * Operación separada e independiente para el control de inventario y existencias por el Dueño.
 * Muestra valores actuales, valida que el stock no sea negativo (>= 0) y actualiza Supabase.
 */
function ModificarStockDialog({ open, onClose, producto, onSuccess }) {
  const [nuevoStock, setNuevoStock] = useState('');
  const [nuevoMinimo, setNuevoMinimo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const stockActual = useMemo(() => {
    return Number(producto?.stock || 0);
  }, [producto]);

  const minimoActual = useMemo(() => {
    return Number(producto?.stock_minimo ?? producto?.minimo ?? 0);
  }, [producto]);

  const unidad = producto?.unidad || 'un';

  // Inicializar al abrir el diálogo con los datos actuales
  useEffect(() => {
    if (open && producto) {
      setNuevoStock(producto.stock !== undefined ? String(producto.stock) : '0');
      setNuevoMinimo(
        producto.stock_minimo !== undefined
          ? String(producto.stock_minimo)
          : producto.minimo !== undefined
          ? String(producto.minimo)
          : '5'
      );
      setErrorMsg('');
    }
  }, [open, producto]);

  // Validación en tiempo real
  const parsedStock = Number(nuevoStock);
  const parsedMinimo = Number(nuevoMinimo);

  const isStockEmpty = nuevoStock.trim() === '';
  const isStockNumeric = !isNaN(parsedStock) && !isStockEmpty;
  const isStockNonNegative = isStockNumeric && parsedStock >= 0;
  const isStockInteger = isStockNumeric && Number.isInteger(parsedStock);

  const isMinimoValid = nuevoMinimo.trim() === '' || (!isNaN(parsedMinimo) && parsedMinimo >= 0);

  const isFormValido = isStockNonNegative && isStockInteger && isMinimoValid;

  // Cálculo del estado proyectado según el nuevo stock
  const estadoProyectado = useMemo(() => {
    if (!isStockNonNegative) return null;
    const minVal = isNaN(parsedMinimo) ? minimoActual : parsedMinimo;
    if (parsedStock <= 0) {
      return { label: 'SIN STOCK', color: '#B71C1C', bg: '#FFCDD2', icon: <ErrorOutlinedIcon fontSize="small" /> };
    }
    if (parsedStock <= minVal) {
      return { label: 'CRÍTICO (BAJO MÍNIMO)', color: '#C62828', bg: '#FFEBEE', icon: <ErrorOutlinedIcon fontSize="small" /> };
    }
    if (parsedStock <= minVal * 1.3) {
      return { label: 'ADVERTENCIA', color: '#E65100', bg: '#FFF3E0', icon: <WarningAmberIcon fontSize="small" /> };
    }
    return { label: 'ÓPTIMO', color: '#2E7D32', bg: '#E8F5E9', icon: <CheckCircleOutlinedIcon fontSize="small" /> };
  }, [isStockNonNegative, parsedStock, parsedMinimo, minimoActual]);

  const handleStockChange = (e) => {
    const val = e.target.value;
    setNuevoStock(val);

    if (val.trim() === '') {
      setErrorMsg('El stock es obligatorio.');
    } else {
      const num = Number(val);
      if (isNaN(num)) {
        setErrorMsg('El stock debe ser un valor numérico.');
      } else if (num < 0) {
        setErrorMsg('El stock no puede ser un valor negativo (mínimo 0).');
      } else if (!Number.isInteger(num)) {
        setErrorMsg('El stock debe ser un número entero (sin decimales).');
      } else {
        setErrorMsg('');
      }
    }
  };

  const handleMinimoChange = (e) => {
    const val = e.target.value;
    setNuevoMinimo(val);

    if (val.trim() !== '') {
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        setErrorMsg('El stock mínimo no puede ser un valor negativo.');
        return;
      }
    }
    if (isStockNonNegative && isStockInteger) {
      setErrorMsg('');
    }
  };

  // Botones de ajuste rápido (+1, +5, +10, -1, -5)
  const ajustarStockRapido = (delta) => {
    const actual = isNaN(parsedStock) ? 0 : parsedStock;
    const resultado = actual + delta;
    if (resultado < 0) {
      setErrorMsg('El stock no puede ser negativo.');
      setNuevoStock('0');
    } else {
      setNuevoStock(String(resultado));
      setErrorMsg('');
    }
  };

  const handleGuardar = async () => {
    if (!producto) return;

    if (nuevoStock.trim() === '') {
      setErrorMsg('El stock es obligatorio.');
      return;
    }

    const stockFinal = Number(nuevoStock);
    if (isNaN(stockFinal) || stockFinal < 0) {
      setErrorMsg('El stock no puede ser un valor negativo (debe ser mayor o igual a 0).');
      return;
    }

    if (!Number.isInteger(stockFinal)) {
      setErrorMsg('El stock debe ser un número entero.');
      return;
    }

    const minimoFinal = nuevoMinimo.trim() !== '' ? Number(nuevoMinimo) : minimoActual;
    if (isNaN(minimoFinal) || minimoFinal < 0) {
      setErrorMsg('El stock mínimo no puede ser un valor negativo.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      // Actualizar en Supabase mediante el servicio dedicado (FR-47)
      const productoActualizado = await productosService.updateStock(
        producto.id,
        stockFinal,
        minimoFinal
      );

      if (onSuccess) {
        onSuccess(
          productoActualizado,
          `Stock de "${producto.nombre}" actualizado a ${stockFinal} ${unidad}.`
        );
      }
      onClose();
    } catch (err) {
      console.error('Error al actualizar stock en Supabase:', err);
      setErrorMsg(err.message || 'Error al conectar con el servidor para actualizar el stock.');
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
          maxWidth: 460,
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
              color: '#4A3728',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1.8,
            }}
          >
            <Inventory2OutlinedIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#3E2D22', lineHeight: 1.2 }}>
              Modificar Stock e Inventario
            </Typography>
            <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
              Ajuste de Existencias en Bodega
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
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Box sx={{ maxWidth: '65%' }}>
              <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600, display: 'block' }}>
                INSUMO / PRODUCTO
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

          {/* Valores Actuales de Stock y Mínimo */}
          <Box
            sx={{
              pt: 1.5,
              borderTop: '1px dashed #E8E1DA',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: '#78665B', display: 'block' }}>
                Stock Actual:
              </Typography>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{
                  color: stockActual <= 0 ? '#B71C1C' : stockActual <= minimoActual ? '#C62828' : '#3E2D22',
                }}
              >
                {stockActual} <Typography component="span" variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>{unidad}</Typography>
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: '#78665B', display: 'block' }}>
                Mínimo Requerido:
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#5C4535' }}>
                {minimoActual} <Typography component="span" variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>{unidad}</Typography>
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Formulario de Modificación de Stock */}
        <Stack spacing={2}>
          {/* Campo de Stock Disponible */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B' }}>
                Nuevo Stock Disponible ({unidad}) *
              </Typography>
              <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
                Mínimo permitido: 0
              </Typography>
            </Stack>

            <TextField
              size="small"
              fullWidth
              autoFocus
              type="number"
              value={nuevoStock}
              onChange={handleStockChange}
              disabled={saving}
              error={Boolean(errorMsg && errorMsg.includes('stock'))}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ color: '#78665B', fontWeight: 700, fontSize: '0.85rem' }}>
                    {unidad}
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

            {/* Botones de Ajuste Rápido (+1, +5, +10, -1, -5) */}
            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#8C7A6F', mr: 0.5, fontWeight: 600 }}>
                Ajuste:
              </Typography>
              <Tooltip title="Disminuir 5 unidades">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => ajustarStockRapido(-5)}
                  disabled={saving || parsedStock < 5}
                  sx={{ minWidth: 36, px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: '8px', borderColor: '#E0D4C8', color: '#6E5C50' }}
                >
                  -5
                </Button>
              </Tooltip>
              <Tooltip title="Disminuir 1 unidad">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => ajustarStockRapido(-1)}
                  disabled={saving || parsedStock < 1}
                  sx={{ minWidth: 36, px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: '8px', borderColor: '#E0D4C8', color: '#6E5C50' }}
                >
                  -1
                </Button>
              </Tooltip>
              <Tooltip title="Sumar 1 unidad">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => ajustarStockRapido(1)}
                  disabled={saving}
                  sx={{ minWidth: 36, px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: '8px', borderColor: '#E0D4C8', color: '#6E5C50' }}
                >
                  +1
                </Button>
              </Tooltip>
              <Tooltip title="Sumar 5 unidades (reposición)">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => ajustarStockRapido(5)}
                  disabled={saving}
                  sx={{ minWidth: 36, px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: '8px', borderColor: '#E0D4C8', color: '#6E5C50' }}
                >
                  +5
                </Button>
              </Tooltip>
              <Tooltip title="Sumar 10 unidades">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => ajustarStockRapido(10)}
                  disabled={saving}
                  sx={{ minWidth: 36, px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: '8px', borderColor: '#E0D4C8', color: '#6E5C50' }}
                >
                  +10
                </Button>
              </Tooltip>
            </Stack>
          </Box>

          {/* Campo de Stock Mínimo de Alerta */}
          <Box>
            <Typography variant="caption" fontWeight={700} sx={{ color: '#78665B', display: 'block', mb: 0.8 }}>
              Umbral Mínimo Requerido ({unidad})
            </Typography>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={nuevoMinimo}
              onChange={handleMinimoChange}
              disabled={saving}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ color: '#8C7A6F', fontSize: '0.78rem' }}>
                    {unidad}
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 600,
                  '& fieldset': {
                    borderColor: '#D8CDC4',
                  },
                },
              }}
            />
          </Box>

          {/* Previsualización del Estado Resultante */}
          {estadoProyectado && (
            <Paper
              elevation={0}
              sx={{
                p: 1.2,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: estadoProyectado.color,
                backgroundColor: estadoProyectado.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {estadoProyectado.icon}
                <Typography variant="caption" fontWeight={700} sx={{ color: estadoProyectado.color }}>
                  Estado proyectado: {estadoProyectado.label}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: estadoProyectado.color, fontWeight: 800 }}>
                {parsedStock} {unidad}
              </Typography>
            </Paper>
          )}

          {/* Mensaje de Error de Validación (Valida stock negativo) */}
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
              disabled={saving || !isFormValido}
              onClick={handleGuardar}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                borderRadius: '24px',
                textTransform: 'none',
                backgroundColor: '#4A3728',
                color: '#FFFFFF',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#38281E',
                  boxShadow: 'none',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#E0D6CE',
                  color: '#A0948A',
                },
              }}
            >
              {saving ? 'Guardando...' : 'Actualizar Stock'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default ModificarStockDialog;
