import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import PrintIcon from '@mui/icons-material/Print';
import TimeAgo from './TimeAgo';
import { parsearFecha, formatearHora } from '../utils/dateUtils';
import impresionService from '../services/impresionService';

const etiquetaPorEstado = {
  pendiente: { fondo: '#F2ECE7', texto: '#4A3B32', label: 'PENDIENTE' },
  preparando: { fondo: '#FFF3E0', texto: '#E65100', label: 'EN PREPARACIÓN' },
  en_preparacion: { fondo: '#FFF3E0', texto: '#E65100', label: 'EN PREPARACIÓN' },
  listo: { fondo: '#E8F5E9', texto: '#2E7D32', label: 'LISTO PARA RETIRO' },
};

const botonPorEstado = {
  pendiente: { label: 'COMENZAR PREPARACIÓN', background: '#4A3B32', siguiente: 'en_preparacion' },
  preparando: { label: 'MARCAR COMO LISTO', background: '#E65100', siguiente: 'listo' },
  en_preparacion: { label: 'MARCAR COMO LISTO', background: '#E65100', siguiente: 'listo' },
};

function getHoraRetiro(pedido) {
  if (pedido.hora_retiro) return formatearHora(pedido.hora_retiro);
  if (pedido.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) {
      return formatearHora(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  const etiqueta = etiquetaPorEstado[pedido.estado];
  const boton = botonPorEstado[pedido.estado];
  const horaRetiro = getHoraRetiro(pedido);
  const estadoImpresion = impresionService.getEstadoImpresion(pedido.rawId ?? pedido.id);

  return (
    <Card
      elevation={3}
      sx={{
        borderRadius: 3,
        border: '1px solid #EFEAE6',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(74, 59, 50, 0.14)',
        '&:active': { transform: 'scale(0.99)' },
        '&:hover': { boxShadow: '0 12px 28px rgba(74, 59, 50, 0.2)' },
        mb: 2,
      }}
      onClick={() => onOpen(pedido)}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center'}}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' } }}>
                {pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`}
              </Typography>
              {estadoImpresion.veces > 0 && (
                <Tooltip
                  title={
                    estadoImpresion.veces > 1
                      ? `Comanda reimpresa (${estadoImpresion.veces} veces)`
                      : 'Comanda impresa para cocina'
                  }
                >
                  <Chip
                    size="small"
                    icon={<PrintIcon sx={{ fontSize: '13px !important' }} />}
                    label={estadoImpresion.veces > 1 ? `×${estadoImpresion.veces}` : 'Impresa'}
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: estadoImpresion.veces > 1 ? '#FFF3E0' : '#EFEBE9',
                      color: estadoImpresion.veces > 1 ? '#E65100' : '#5D4037',
                    }}
                  />
                </Tooltip>
              )}
            </Stack>
            {/* El KDS muestra todas las cafeterias, asi que la comanda lleva el
                nombre de donde salio para no entregar un pedido en la otra. */}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {pedido.cafeteria_nombre || pedido.ubicacion || ''}
              {pedido.franja_retiro ? ` · Retiro ${pedido.franja_retiro}` : ''}
            </Typography>
          </Box>
            <TimeAgo pedido={pedido} sx={{ fontSize: '1.15rem', fontWeight: 800 }} />
        </Stack>

        <Stack direction="row" sx={{ mt: 1.5, justifyContent: 'space-between', alignItems: 'center'}}>
          {etiqueta && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                px: 2.5,
                borderRadius: 2,
                backgroundColor: etiqueta.fondo,
                color: etiqueta.texto,
                fontWeight: 900,
                letterSpacing: 0.5,
                fontSize: '1.05rem',
              }}
            >
              {etiqueta.label}
            </Box>
          )}

          <Typography
            fontWeight={900}
            sx={{ color: '#4A3B32', whiteSpace: 'nowrap', fontSize: '1.15rem' }}
          >
            🕐 {horaRetiro}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ maxHeight: 170, overflowY: 'auto' }}>
          {pedido.productos?.map((item, idx) => (
            <Typography
              key={idx}
              fontWeight={800}
              sx={{ fontSize: '1.2rem', color: '#4A3B32', lineHeight: 1.6 }}
            >
              {item.nombre} × {item.cantidad}
            </Typography>
          )) || <Typography sx={{ color: 'text.secondary' }}>Sin productos</Typography>}
        </Box>
      </CardContent>

      {boton && (
        <Box sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={(e) => onChangeEstado(pedido.rawId ?? pedido.id, boton.siguiente, e)}
            sx={{
              minHeight: 56,
              minWidth: 56,
              backgroundColor: boton.background,
              fontSize: '1.05rem',
              fontWeight: 800,
              letterSpacing: 0.5,
              '&:hover': {
                backgroundColor: boton.background,
                filter: 'brightness(0.92)',
              },
            }}
          >
            {boton.label}
          </Button>
        </Box>
      )}
    </Card>
  );
}

export default PedidoCard;