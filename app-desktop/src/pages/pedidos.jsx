import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const pedidosMock = [
  {
    id: '1264-D',
    cliente: 'siuu',
    hora: '08:22 AM',
    ubicacion: 'Edificio 7',
    productos: [
      {
        nombre: 'Café Americano',
        cantidad: 1,
        detalle: 'Sin azúcar',
      },
      {
        nombre: 'Capuchino',
        cantidad: 1,
        detalle: 'Leche descremada',
      },
      {
        nombre: 'Croissant',
        cantidad: 2,
        detalle: 'Sin modificaciones',
      },
    ],
    estado: 'Pendiente',
  },
  {
    id: '0777-W',
    cliente: 'Tilin Vargas',
    hora: '10:25 AM',
    ubicacion: 'Edificio 7',
    productos: [
      {
        nombre: 'Sándwich Ave Mayo',
        cantidad: 1,
        detalle: 'Sin ají',
      },
      {
        nombre: 'Café Americano (Mediano)',
        cantidad: 1,
        detalle: 'Dos azúcares',
      },
      {
        nombre: 'Empanada de Queso',
        cantidad: 1,
        detalle: 'Sin modificaciones',
      },
      {
        nombre: 'Jugo Natural en Botella 500ml',
        cantidad: 1,
        detalle: 'Sin modificaciones',
      },
    ],
    estado: 'En_preparacion',
  },
  {
    id: '2026-B',
    cliente: 'ola',
    hora: '02:01 PM',
    ubicacion: 'Edificio 7',
    productos: [
      {
        nombre: 'Latte',
        cantidad: 1,
        detalle: 'Leche descremada',
      },
      {
        nombre: 'Brownie',
        cantidad: 1,
        detalle: 'Sin modificaciones',
      },
      {
        nombre: 'Café Americano',
        cantidad: 2,
        detalle: 'Sin azúcar',
      },
    ],
    estado: 'Listo',
  },
];

// Define la apariencia y el texto de cada estado del pedido.
const estilosEstado = {
  Pendiente: {
    label: 'Pendiente',
    background: '#F2ECE7',
    color: '#4A3B32',
    boton: 'Preparar',
  },
  En_preparacion: {
    label: 'En preparación',
    background: '#FFF3E0',
    color: '#E65100',
    boton: 'Completar',
  },
  Listo: {
    label: 'Listo',
    background: '#E8F5E9',
    color: '#2E7D32',
    boton: 'Entregar',
  },
};

function PedidoCard({ pedido, onOpenDetails }) {
  const estado = estilosEstado[pedido.estado];

  const totalProductos = pedido.productos.reduce(
    (total, producto) => total + producto.cantidad,
    0
  );

  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Identificación del pedido y estado actual */}
      <Box
        sx={{
          px: 2,
          py: 1,
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography fontWeight={600}>
          #{pedido.id}
        </Typography>

        <Chip
          label={estado.label}
          size="small"
          sx={{
            backgroundColor: estado.background,
            color: estado.color,
            fontWeight: 600,
          }}
        />
      </Box>

      <CardContent>
        {/* Cliente, hora y ubicación alineados */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
          mb={2}
        >
          <Box>
            <Typography fontWeight={600}>
              {pedido.cliente}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {pedido.ubicacion}
            </Typography>
          </Box>

          <Typography
            variant="body2"
            fontWeight={600}
            color="text.secondary"
            sx={{ textAlign: 'right' }}
          >
            {pedido.hora}
          </Typography>
        </Stack>

        {/* Clic en los productos abre el modal */}
        <Box
          onClick={() => onOpenDetails(pedido)}
          sx={{
            backgroundColor: 'background.default',
            borderRadius: 2,
            p: 2,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Stack spacing={1}>
            {pedido.productos.map((producto, index) => (
              <Box
                key={`${producto.nombre}-${index}`}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Typography variant="body2">
                  {producto.cantidad}x {producto.nombre}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="right"
            mt={1}
          >
            {totalProductos}{' '}
            {totalProductos === 1 ? 'item' : 'items'} en total
          </Typography>
        </Box>

        {/* Botón de acción (estático por ahora) */}
        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
        >
          {estado.boton}
        </Button>
      </CardContent>
    </Card>
  );
}

function PedidoDetalleModal({ pedido, onClose }) {
  if (!pedido) {
    return null;
  }

  const estado = estilosEstado[pedido.estado];

  return (
    <Dialog
      open={Boolean(pedido)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      {/* Cabecera azul idéntica a la estructura inicial */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <Typography fontWeight={600}>
          #{pedido.id}
        </Typography>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            label={estado.label}
            size="small"
            sx={{
              backgroundColor: estado.background,
              color: estado.color,
              fontWeight: 600,
            }}
          />

          <IconButton
            onClick={onClose}
            sx={{ color: 'inherit' }}
            aria-label="Cerrar detalles"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Información general del cliente y hora */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
          mt={1}
        >
          <Box>
            <Typography fontWeight={600}>
              {pedido.cliente}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {pedido.ubicacion}
            </Typography>
          </Box>

          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ textAlign: 'right' }}
          >
            {pedido.hora}
          </Typography>
        </Stack>

        {/* Desglose completo de productos con sus especificaciones */}
        <Box
          sx={{
            backgroundColor: 'background.default',
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Detalle del pedido
          </Typography>

          <Stack spacing={2}>
            {pedido.productos.map((producto, index) => (
              <Box key={`${producto.nombre}-${index}`}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {producto.nombre}
                  </Typography>

                  <Typography variant="body2" fontWeight={600}>
                    x{producto.cantidad}
                  </Typography>
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.85rem', mt: 0.2 }}
                >
                  Especificación: {producto.detalle}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Botón de cierre */}
        <Button
          fullWidth
          variant="contained"
          onClick={onClose}
          sx={{ mt: 3 }}
        >
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Pedidos() {
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);

  return (
    <Box>
      {/* Encabezado principal de la pantalla KDS. */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Panel de Cocina
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Pedidos recibidos en la cafetería
        </Typography>
      </Box>

      {/* Grid responsivo */}
      <Grid container spacing={3}>
        {pedidosMock.map((pedido) => (
          <Grid item xs={12} md={6} lg={4} key={pedido.id}>
            <PedidoCard
              pedido={pedido}
              onOpenDetails={setPedidoSeleccionado}
            />
          </Grid>
        ))}
      </Grid>

      {/* Modal con la estructura y estilo original */}
      <PedidoDetalleModal
        pedido={pedidoSeleccionado}
        onClose={() => setPedidoSeleccionado(null)}
      />
    </Box>
  );
}