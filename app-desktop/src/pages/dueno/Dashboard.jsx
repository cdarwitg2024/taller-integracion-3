import { useState, useEffect } from 'react';
import { Box, Grid, Alert, Button, LinearProgress, Typography } from '@mui/material';

import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import pedidosService from '../../services/pedidosService';
import KpiCards from '../../components/dashboard/KpiCards';
import SalesChart from '../../components/dashboard/SalesChart';
import OrdersDistributionChart from '../../components/dashboard/OrdersDistributionChart';
import TopProductsChart from '../../components/dashboard/TopProductsChart';
import RecentOrdersTable from '../../components/dashboard/RecentOrdersTable';

function Dashboard({ currentUser }) {
  const [stats, setStats] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [ultimaActualizacionExitosa, setUltimaActualizacionExitosa] = useState(null);

  // S2-T18: el alcance de cafetería proviene del perfil del dueño. Desde
  // S2-T12 `getAll` exige cafeteriaId y no acepta un fallback fijo, así que
  // el Dashboard debe pasarlo explícitamente.
  const cafeteriaId =
    currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? null;

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setDbError(null);

    if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
      setDbError(
        'Tu usuario no tiene una cafetería autorizada asociada. No es posible calcular los indicadores.'
      );
      setStats(null);
      setPedidos([]);
      setSalesData([]);
      setTopProducts([]);
      if (showLoading) setLoading(false);
      return;
    }

    try {
      // Snapshot comun de pedidos (S2-T12): un solo getAll; los indicadores derivan sus metricas
      const pedidos = await pedidosService.getAll({ cafeteriaId });

      const [resStats, resSales, resTop] = await Promise.all([
        pedidosService.getEstadisticas(pedidos),
        pedidosService.getVentasPorHora(pedidos),
        pedidosService.getTopProductos(pedidos),
      ]);

      setStats(resStats);
      setPedidos(pedidos);
      setSalesData(resSales);
      setTopProducts(resTop);

      // Última actualización exitosa (S2-T13): solo se registra en una carga exitosa
      setUltimaActualizacionExitosa(new Date().toISOString());
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
      setDbError(
        err.message || 'No se pudieron consultar los datos del Dashboard.'
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
    let activo = true;
    let cargando = false;
    const refrescar = async (inicial = false) => {
      if (!activo || cargando) return;
      cargando = true;
      try { await loadData(inicial); } finally { cargando = false; }
    };
    refrescar(true);
    // Igual que KDS: respaldo de 10 segundos si Realtime pierde un evento.
    const poll = setInterval(() => refrescar(false), 10000);
    if (!isSupabaseConfigured) return () => { activo = false; clearInterval(poll); };

    const canalDashboard = supabase.channel('dueno-dashboard-realtime');

    canalDashboard
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          refrescar(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'detalles_pedido' },
        () => {
          refrescar(false);
        }
      )
      .subscribe();

    return () => {
      activo = false;
      clearInterval(poll);
      supabase.removeChannel(canalDashboard);
    };
  }, [cafeteriaId]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', pb: 4, boxSizing: 'border-box' }}>
      {/* Estado de Carga */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress color="primary" />
        </Box>
      )}

      {/* Última actualización exitosa (S2-T13) */}
      {!loading && !dbError && ultimaActualizacionExitosa && (
        <Typography variant="caption" sx={{ color: '#8C7A6F', display: 'block', mb: 2 }}>
          Última actualización: {new Date(ultimaActualizacionExitosa).toLocaleTimeString()}
        </Typography>
      )}

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

      {!loading && !dbError && stats?.totalPedidos === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No hay pedidos registrados para esta cafetería.
        </Alert>
      )}
      {!loading && !dbError && <>
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
      </>}
    </Box>
  );
}

export default Dashboard;
