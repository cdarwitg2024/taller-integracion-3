import { useState, useEffect } from 'react';
import { Box, Grid } from '@mui/material';

import pedidosService from '../services/pedidosService';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import KpiCards from '../components/dashboard/KpiCards';
import SalesChart from '../components/dashboard/SalesChart';
import OrdersDistributionChart from '../components/dashboard/OrdersDistributionChart';
import TopProductsChart from '../components/dashboard/TopProductsChart';
import RecentOrdersTable from '../components/dashboard/RecentOrdersTable';

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
      console.error('Error cargando datos del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* 1. Encabezado y Acción de Actualizar */}
      <DashboardHeader onRefresh={loadData} loading={loading} />

      {/* 2. Tarjetas de Indicadores Principales (KPIs) */}
      <KpiCards stats={stats} />

      {/* 3. Gráficos de Ventas y Distribución */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <SalesChart />
        </Grid>
        <Grid item xs={12} lg={4}>
          <OrdersDistributionChart stats={stats} />
        </Grid>
      </Grid>

      {/* 4. Productos Populares y Tabla de Últimos Pedidos */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <TopProductsChart />
        </Grid>
        <Grid item xs={12} lg={7}>
          <RecentOrdersTable pedidos={pedidos} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;