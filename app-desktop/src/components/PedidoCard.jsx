import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

import TimeAgo from './TimeAgo';

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

function formatoHM(fecha) {
  const h24 = fecha.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')} ${ampm}`;
}

function getHoraRetiro(pedido) {
  if (pedido.hora_retiro) return pedido.hora_retiro;
  if (pedido.creado_en) {
    const fecha = new Date(pedido.creado_en);
    if (!Number.isNaN(fecha.getTime())) {
      return formatoHM(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function PedidoCard({ pedido, onOpen, onChangeEstado }) {
  const etiqueta = etiquetaPorEstado[pedido.estado];
  const boton = botonPorEstado[pedido.estado];
  const horaRetiro = getHoraRetiro(pedido);

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
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
            #{pedido.id}
          </Typography>
          <TimeAgo pedido={pedido} sx={{ fontSize: '1.05rem' }} />
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
          {etiqueta && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 40,
                px: 2,
                borderRadius: 2,
                backgroundColor: etiqueta.fondo,
                color: etiqueta.texto,
                fontWeight: 800,
                letterSpacing: 0.5,
              }}
            >
              {etiqueta.label}
            </Box>
          )}

          <Typography
            fontWeight={800}
            sx={{ color: '#4A3B32', whiteSpace: 'nowrap', fontSize: '1.05rem' }}
          >
            🕐 {horaRetiro}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ maxHeight: 170, overflowY: 'auto' }}>
          {pedido.productos?.map((item, idx) => (
            <Typography
              key={idx}
              fontWeight={700}
              sx={{ fontSize: '1.1rem', color: '#4A3B32', lineHeight: 1.5 }}
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
            onClick={(e) => onChangeEstado(pedido.id, boton.siguiente, e)}
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