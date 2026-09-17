import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Tabs,
  Tab,
  InputAdornment,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

import PedidoCard from '../components/PedidoCard';
import DetallePedidoDialog from '../components/DetallePedidoDialog';

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

        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={fetchPedidos} sx={{ minHeight: 48 }}>
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
              sx={{ '& .MuiTab-root': { minHeight: 48 } }}
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
                {loading ? 'Cargando pedidos...' : 'No hay pedidos que coincidan con el filtro seleccionado.'}
              </Typography>
            </Box>
          </Grid>
        ) : (
          filteredPedidos.map((pedido) => (
            <Grid item xs={12} sm={6} md={4} key={pedido.id}>
              <PedidoCard
                pedido={pedido}
                onOpen={setSelectedPedido}
                onChangeEstado={handleCambiarEstado}
              />
            </Grid>
          ))
        )}
      </Grid>

      {/* Modal Detalle de Pedido */}
      <DetallePedidoDialog
        pedido={selectedPedido}
        onClose={() => setSelectedPedido(null)}
        onChangeEstado={handleCambiarEstado}
      />
    </Box>
  );
}

export default Pedidos;