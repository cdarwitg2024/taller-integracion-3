import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  CircularProgress,
} from '@mui/material';

import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

import pedidosService from '../services/pedidosService';

const salesData = [
  { hora: '08:00', ventas: 12400, pedidos: 5 },
  { hora: '09:00', ventas: 28500, pedidos: 12 },
  { hora: '10:00', ventas: 42000, pedidos: 18 },
  { hora: '11:00', ventas: 31000, pedidos: 14 },
  { hora: '12:00', ventas: 54000, pedidos: 22 },
  { hora: '13:00', ventas: 68000, pedidos: 29 },
  { hora: '14:00', ventas: 38000, pedidos: 15 },
];

const topProductosData = [
  { nombre: 'Café Americano', cantidad: 45 },
  { nombre: 'Capuchino', cantidad: 38 },
  { nombre: 'Sándwich Ave Mayo', cantidad: 32 },
  { nombre: 'Croissant', cantidad: 28 },
  { nombre: 'Muffin Arándanos', cantidad: 19 },
];

const COLORS = ['#1976d2', '#ed6c02', '#2e7d32', '#9c27b0'];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStats, resPedidos] = await Promise.all([
        pedidosService.getEstadisticas(),
        pedidosService.getAll(),
      ]);
      setStats(resStats);
      setPedidos(resPedidos);
    } catch (err) {
      console.error('Error cargando métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getEstadoChip = (estado) => {
    switch (estado) {
      case 'pendiente':
        return <Chip label="Pendiente" color="error" size="small" variant="filled" />;
      case 'preparando':
        return <Chip label="En Preparación" color="warning" size="small" variant="filled" />;
      case 'listo':
        return <Chip label="Listo para Retiro" color="info" size="small" variant="filled" />;
      case 'entregado':
        return <Chip label="Entregado" color="success" size="small" variant="filled" />;
      default:
        return <Chip label={estado} size="small" />;
    }
  };

  const pieData = stats ? [
    { name: 'Pendientes', value: stats.pendientes },
    { name: 'En Prep.', value: stats.preparando },
    { name: 'Listos', value: stats.listos },
    { name: 'Entregados', value: stats.entregados },
  ] : [];

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="primary.main">
            Dashboard de Cafetería
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Métricas en tiempo real, pedidos activos y rendimiento de ventas.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          Actualizar Datos
        </Button>
      </Stack>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '6px solid #2e7d32' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Ventas del Día
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                    ${stats?.totalVentas?.toLocaleString('es-CL') || 0}
                  </Typography>
                </Box>
                <AttachMoneyIcon sx={{ fontSize: 44, color: 'success.main', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '6px solid #1976d2' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Total Pedidos
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                    {stats?.totalPedidos || 0}
                  </Typography>
                </Box>
                <ShoppingBagIcon sx={{ fontSize: 44, color: 'primary.main', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '6px solid #ed6c02' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Pendientes / En Prep.
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                    {(stats?.pendientes || 0) + (stats?.preparando || 0)}
                  </Typography>
                </Box>
                <PendingActionsIcon sx={{ fontSize: 44, color: 'warning.main', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '6px solid #9c27b0' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Tiempo Prom. Prep.
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                    {stats?.tiempoPromedioMin || 0} min
                  </Typography>
                </Box>
                <AccessTimeIcon sx={{ fontSize: 44, color: 'purple', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gráficos */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Gráfico de Ventas por Hora */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3, height: 380 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              📈 Tendencia de Ventas por Hora ($ CLP)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hora" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString('es-CL')}`} />
                <Area type="monotone" dataKey="ventas" stroke="#1976d2" fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Distribución por Estado */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3, height: 380 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
              🍰 Distribución de Estados
            </Typography>
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabla de Actividad Reciente */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          ⚡ Actividad Reciente de Pedidos
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell><strong>ID Pedido</strong></TableCell>
                  <TableCell><strong>Cliente</strong></TableCell>
                  <TableCell><strong>Ubicación Campus</strong></TableCell>
                  <TableCell><strong>Hora</strong></TableCell>
                  <TableCell><strong>Monto Total</strong></TableCell>
                  <TableCell><strong>Estado</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pedidos.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><strong>#{row.id}</strong></TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell>{row.ubicacion}</TableCell>
                    <TableCell>{row.hora}</TableCell>
                    <TableCell>${row.total?.toLocaleString('es-CL')}</TableCell>
                    <TableCell>{getEstadoChip(row.estado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default Dashboard;