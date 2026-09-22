import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Grid,
  IconButton,
  Stack,
  Typography,
  TextField,
  Tabs,
  Tab,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';

import pedidosService from '../services/pedidosService';

function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPedidos = async () => {
    setLoading(true);
    const data = await pedidosService.getAll();
    setPedidos(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

  const handleCambiarEstado = async (id, nuevoEstado, e) => {
    if (e) e.stopPropagation();
    const updated = await pedidosService.updateEstado(id, nuevoEstado);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    if (selectedPedido && selectedPedido.id === id) {
      setSelectedPedido(prev => ({ ...prev, estado: nuevoEstado }));
    }
  };

  const estadosFiltro = ['todos', 'pendiente', 'preparando', 'listo', 'entregado'];

  const filteredPedidos = pedidos.filter(p => {
    const coincideEstado = tabIndex === 0 || p.estado === estadosFiltro[tabIndex];
    const coincideBusqueda =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.qr_token.toLowerCase().includes(searchQuery.toLowerCase());
    return coincideEstado && coincideBusqueda;
  });

  const getChipForEstado = (estado) => {
    switch (estado) {
      case 'pendiente':
        return <Chip label="Pendiente" color="error" fontWeight={700} />;
      case 'preparando':
        return <Chip label="En Preparación" color="warning" fontWeight={700} />;
      case 'listo':
        return <Chip label="Listo para Retiro" color="info" fontWeight={700} />;
      case 'entregado':
        return <Chip label="Entregado" color="success" fontWeight={700} />;
      default:
        return <Chip label={estado} />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="primary.main">
            Gestión de Pedidos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra las comandas activas y actualiza sus estados para los alumnos.
          </Typography>
        </Box>

        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={fetchPedidos}>
          Refrescar
        </Button>
      </Stack>

      {/* Barra de Búsqueda y Pestañas de Filtro */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={7}>
            <Tabs
              value={tabIndex}
              onChange={(e, val) => setTabIndex(val)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label={`Todos (${pedidos.length})`} />
              <Tab label={`Pendientes (${pedidos.filter(p => p.estado === 'pendiente').length})`} />
              <Tab label={`En Prep. (${pedidos.filter(p => p.estado === 'preparando').length})`} />
              <Tab label={`Listos (${pedidos.filter(p => p.estado === 'listo').length})`} />
              <Tab label={`Entregados (${pedidos.filter(p => p.estado === 'entregado').length})`} />
            </Tabs>
          </Grid>

          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por ID, cliente o código QR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Rejilla de Tarjetas de Pedidos */}
      <Grid container spacing={3}>
        {filteredPedidos.length === 0 ? (
          <Grid item xs={12}>
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="text.secondary">
                No hay pedidos que coincidan con el filtro seleccionado.
              </Typography>
            </Box>
          </Grid>
        ) : (
          filteredPedidos.map((pedido) => (
            <Grid item xs={12} sm={6} md={4} key={pedido.id}>
              <Card
                elevation={3}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                  borderTop: `6px solid ${
                    pedido.estado === 'pendiente'
                      ? '#d32f2f'
                      : pedido.estado === 'preparando'
                      ? '#ed6c02'
                      : pedido.estado === 'listo'
                      ? '#0288d1'
                      : '#2e7d32'
                  }`,
                }}
                onClick={() => setSelectedPedido(pedido)}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h6" fontWeight={800}>
                      #{pedido.id}
                    </Typography>
                    {getChipForEstado(pedido.estado)}
                  </Stack>

                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    {pedido.cliente}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    ⏰ {pedido.hora} - {pedido.ubicacion}
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    PRODUCTOS ({pedido.productos?.length || 0}):
                  </Typography>
                  <List disablePadding sx={{ my: 1 }}>
                    {pedido.productos?.slice(0, 2).map((item, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.2 }}>
                        <ListItemText
                          primary={`${item.cantidad}x ${item.nombre}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                    {(pedido.productos?.length || 0) > 2 && (
                      <Typography variant="caption" color="primary">
                        +{(pedido.productos.length - 2)} más...
                      </Typography>
                    )}
                  </List>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight={800} color="success.main">
                      ${pedido.total?.toLocaleString('es-CL')}
                    </Typography>

                    {/* Botones de acción directa según estado */}
                    {pedido.estado === 'pendiente' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<PlayArrowIcon />}
                        onClick={(e) => handleCambiarEstado(pedido.id, 'preparando', e)}
                      >
                        Preparar
                      </Button>
                    )}
                    {pedido.estado === 'preparando' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="info"
                        startIcon={<CheckIcon />}
                        onClick={(e) => handleCambiarEstado(pedido.id, 'listo', e)}
                      >
                        Marcar Listo
                      </Button>
                    )}
                    {pedido.estado === 'listo' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<LocalShippingIcon />}
                        onClick={(e) => handleCambiarEstado(pedido.id, 'entregado', e)}
                      >
                        Entregar
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Modal Detalle de Pedido */}
      <Dialog
        open={Boolean(selectedPedido)}
        onClose={() => setSelectedPedido(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {selectedPedido && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight={800}>
                  Detalle de Comanda #{selectedPedido.id}
                </Typography>
                <IconButton onClick={() => setSelectedPedido(null)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body1"><strong>Cliente:</strong> {selectedPedido.cliente}</Typography>
                <Typography variant="body2"><strong>Lugar de Entrega:</strong> {selectedPedido.ubicacion}</Typography>
                <Typography variant="body2"><strong>Código QR:</strong> <code>{selectedPedido.qr_token}</code></Typography>
                <Typography variant="body2"><strong>Estado Actual:</strong> {getChipForEstado(selectedPedido.estado)}</Typography>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Ítems del Pedido:
              </Typography>
              <List disablePadding>
                {selectedPedido.productos?.map((prod, idx) => (
                  <ListItem key={idx} disableGutters>
                    <ListItemText
                      primary={`${prod.cantidad}x ${prod.nombre}`}
                      secondary={prod.detalle}
                    />
                    <Typography fontWeight={700}>
                      ${(prod.precio * prod.cantidad).toLocaleString('es-CL')}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight={800}>Total a Pagar:</Typography>
                <Typography variant="h5" fontWeight={800} color="success.main">
                  ${selectedPedido.total?.toLocaleString('es-CL')}
                </Typography>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
              <Button startIcon={<PrintIcon />} variant="outlined">
                Imprimir Comanda
              </Button>

              <Stack direction="row" spacing={1}>
                {selectedPedido.estado === 'pendiente' && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => handleCambiarEstado(selectedPedido.id, 'preparando')}
                  >
                    Iniciar Preparación
                  </Button>
                )}
                {selectedPedido.estado === 'preparando' && (
                  <Button
                    variant="contained"
                    color="info"
                    onClick={() => handleCambiarEstado(selectedPedido.id, 'listo')}
                  >
                    Marcar Como Listo
                  </Button>
                )}
                {selectedPedido.estado === 'listo' && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleCambiarEstado(selectedPedido.id, 'entregado')}
                  >
                    Confirmar Entrega
                  </Button>
                )}
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default Pedidos;