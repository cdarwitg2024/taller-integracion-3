import { useState, useEffect } from 'react';
import { Box, Grid, Alert, Button } from '@mui/material';

import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
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
  const [dbError, setDbError] = useState(null);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setDbError(null);
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
      setDbError(
        'Sin conexión con la base de datos Supabase. Verifique que el servicio de base de datos se encuentre iniciado.'
      );
      setStats(null);
      setPedidos([]);
      setSalesData([]);
      setTopProducts([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    if (!isSupabaseConfigured) return;

    const canalDashboard = supabase.channel('dueno-dashboard-realtime');

    canalDashboard
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          loadData(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'detalles_pedido' },
        () => {
          loadData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalDashboard);
    };
  }, []);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', pb: 4, boxSizing: 'border-box' }}>
      {/* 1. Encabezado y Acción de Actualizar */}
      <DashboardHeader onRefresh={loadData} loading={loading} />

      {/* Alerta de Error de Base de Datos */}
      {dbError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: '12px', fontWeight: 500 }}
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Reintentar
            </Button>
          }
        >
          {dbError}
        </Alert>
      )}

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
