import { Paper, Typography, Box, Stack, Chip } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';

function OrdersDistributionChart({ stats }) {
  const pendientes = stats?.pendientes ?? 1;
  const preparando = stats?.preparando ?? 1;
  const listos = stats?.listos ?? 1;
  const entregados = stats?.entregados ?? 1;

  const data = [
    {
      name: 'Pendiente',
      etapa: 'Pendientes',
      cantidad: pendientes,
      color: '#D9534F',
      badgeBg: '#FFEBEE',
    },
    {
      name: 'En Prep.',
      etapa: 'En Preparación',
      cantidad: preparando,
      color: '#F0AD4E',
      badgeBg: '#FFF3E0',
    },
    {
      name: 'Listo',
      etapa: 'Listos para Retiro',
      cantidad: listos,
      color: '#C86237',
      badgeBg: '#FBE9E7',
    },
    {
      name: 'Entregado',
      etapa: 'Entregados',
      cantidad: entregados,
      color: '#5CB85C',
      badgeBg: '#E8F5E9',
    },
  ];

  const totalActivos = pendientes + preparando;
  const totalCompletados = listos + entregados;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '16px',
        border: '1px solid #EFEAE6',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        height: 390,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Encabezado del Gráfico */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#4A3728', fontSize: '1.1rem' }}>
          Flujo de Pedidos por Estado
        </Typography>
        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
          Seguimiento por etapas del ciclo de atención
        </Typography>
      </Box>

      {/* Gráfico de Barras Verticales por Estado (Ideal para comparar 4 etapas) */}
      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 220, mt: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2ECE6" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: '#EFEAE6' }}
              tick={{ fill: '#5C4535', fontSize: 11.5, fontWeight: 700 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8C7A6F', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name, props) => [`${value} pedidos`, props?.payload?.etapa || 'Cantidad']}
              contentStyle={{
                backgroundColor: '#4A3728',
                borderRadius: '8px',
                border: 'none',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              itemStyle={{ color: '#F5EBE1', fontWeight: 600 }}
              labelStyle={{ display: 'none' }}
            />
            <Bar dataKey="cantidad" radius={[8, 8, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="cantidad"
                position="top"
                fill="#3E2D22"
                fontWeight={800}
                fontSize={13}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Resumen operativo al pie */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          mt: 2,
          pt: 1.5,
          borderTop: '1px solid #F2ECE6',
        }}
      >
        <Stack direction="row" spacing={0.8} alignItems="center">
          <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
            En cocina:
          </Typography>
          <Chip
            label={`${totalActivos} activos`}
            size="small"
            sx={{
              backgroundColor: '#FFF3E0',
              color: '#E65100',
              fontWeight: 700,
              fontSize: '0.72rem',
              height: 22,
            }}
          />
        </Stack>

        <Stack direction="row" spacing={0.8} alignItems="center">
          <Typography variant="caption" sx={{ color: '#8C7A6F', fontWeight: 600 }}>
            Completados:
          </Typography>
          <Chip
            label={`${totalCompletados} listos`}
            size="small"
            sx={{
              backgroundColor: '#E8F5E9',
              color: '#2E7D32',
              fontWeight: 700,
              fontSize: '0.72rem',
              height: 22,
            }}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}

export default OrdersDistributionChart;
