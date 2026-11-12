import { useState, useEffect, useRef } from 'react';
import { Box, Grid, Alert, Button, LinearProgress, Typography } from '@mui/material';

import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import pedidosService from '../../services/pedidosService';
import { crearCargadorDashboard } from '../../services/cargadorDashboard';
import KpiCards from '../../components/dashboard/KpiCards';
import SalesChart from '../../components/dashboard/SalesChart';
import OrdersDistributionChart from '../../components/dashboard/OrdersDistributionChart';
import TopProductsChart from '../../components/dashboard/TopProductsChart';
import RecentOrdersTable from '../../components/dashboard/RecentOrdersTable';

function Dashboard({ currentUser }) {
  // S2-T18: el alcance de cafetería proviene del perfil del dueño.
  const cafeteriaId =
    currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? null;

  const [estado, setEstado] = useState({
    stats: null,
    pedidos: [],
    salesData: [],
    topProducts: [],
    loading: true,
    dbError: null,
    ultimaActualizacionExitosa: null,
  });

  const {
    stats,
    pedidos,
    salesData,
    topProducts,
    loading,
    dbError,
    ultimaActualizacionExitosa,
  } = estado;

  const cargadorRef = useRef(null);
  if (!cargadorRef.current) {
    cargadorRef.current = crearCargadorDashboard({
      pedidosService,
      onEstadoCambiado: (nuevoEstado) => setEstado(nuevoEstado),
    });
  }

  useEffect(() => {
    const cargador = cargadorRef.current;
    cargador.activar();

    // S3-T2: El cambio de cafetería invalida cargas pendientes y limpia de inmediato
    // los indicadores del contexto anterior para no mostrarlos mientras se carga.
    cargador.cambiarCafeteria(cafeteriaId);

    // Respaldo de 10 segundos si Realtime pierde un evento
    const poll = setInterval(() => {
      cargador.refrescar(false);
    }, 10000);

    let canalDashboard = null;
    if (isSupabaseConfigured) {
      canalDashboard = supabase.channel('dueno-dashboard-realtime');
      canalDashboard
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos' },
          () => {
            cargador.refrescar(false);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'detalles_pedido' },
          () => {
            cargador.refrescar(false);
          }
        )
        .subscribe();
    }

    return () => {
      // S3-T2: Desmontaje o cambio de cafetería invalida cargas pendientes
      clearInterval(poll);
      if (canalDashboard && isSupabaseConfigured) {
        supabase.removeChannel(canalDashboard);
      }
      cargador.desmontar();
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
            <Button
              color="inherit"
              size="small"
              onClick={() => cargadorRef.current?.refrescar(true)}
            >
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
