import { useState, useEffect } from 'react';
import { Box, Grid } from '@mui/material';

import pedidosService from '../../services/pedidosService';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import KpiCards from '../../components/dashboard/KpiCards';
import SalesChart from '../../components/dashboard/SalesChart';
import OrdersDistributionChart from '../../components/dashboard/OrdersDistributionChart';
import TopProductsChart from '../../components/dashboard/TopProductsChart';
import RecentOrdersTable from '../../components/dashboard/RecentOrdersTable';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStats, resPedidos, resSales, resTop] = await Promise.all([
        pedidosService.getEstadisticas(),
        pedidosService.getAll(),
        pedidosService.getVentasPorHora(),
        pedidosService.getTopProductos(),
      ]);
      setStats(resStats);
      setPedidos(resPedidos);
      setSalesData(resSales);
      setTopProducts(resTop);
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
    <Box sx={{ width: '100%', maxWidth: '100%', pb: 4, boxSizing: 'border-box' }}>
      {/* 1. Encabezado y Acción de Actualizar */}
      <DashboardHeader onRefresh={loadData} loading={loading} />

      {/* 2. Tarjetas de Indicadores Principales (KPIs) */}
      <KpiCards stats={stats} />

      {/* 3. Gráficos de Ventas y Distribución */}
      <Grid container spacing={3} sx={{ width: '100%', mb: 4 }}>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <SalesChart salesData={salesData} />
        </Grid>
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <OrdersDistributionChart stats={stats} />
        </Grid>
      </Grid>

      {/* 4. Productos Populares y Tabla de Últimos Pedidos */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 5, lg: 5 }}>
          <TopProductsChart data={topProducts} />
        </Grid>
        <Grid size={{ xs: 12, md: 7, lg: 7 }}>
          <RecentOrdersTable pedidos={pedidos} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
