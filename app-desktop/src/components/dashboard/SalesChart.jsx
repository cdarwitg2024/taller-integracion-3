import { Paper, Typography, Box, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const ventas = Number(item.ventas || 0);
    const pedidos = Number(item.pedidos || 0);

    return (
      <Box
        sx={{
          backgroundColor: '#3B291D',
          color: '#FFFFFF',
          p: 1.5,
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          fontSize: '0.85rem',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Typography variant="caption" sx={{ color: '#D4C4B7', fontWeight: 600, display: 'block', mb: 0.5 }}>
          Tramo: {label} hrs
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
          ${ventas.toLocaleString('es-CL')}
        </Typography>
        <Typography variant="caption" sx={{ color: '#C8A27A', display: 'block', mt: 0.3 }}>
          {pedidos} {pedidos === 1 ? 'pedido registrado' : 'pedidos registrados'}
        </Typography>
      </Box>
    );
  }
  return null;
};

function SalesChart({ salesData }) {
  const data = Array.isArray(salesData) ? salesData : [];
  const hasData = data.length > 0;

  const peakHour = data.reduce(
    (max, d) => (Number(d.ventas || 0) > Number(max?.ventas || 0) ? d : max),
    null
  );

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#4A3728', fontSize: '1.1rem' }}>
            Tendencia de Ventas por Hora
          </Typography>
          <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
            Facturación por tramo horario en la jornada ($ CLP)
          </Typography>
        </Box>

        {peakHour && peakHour.ventas > 0 && (
          <Chip
            icon={<TrendingUpIcon sx={{ fontSize: '16px !important', color: '#C86237 !important' }} />}
            label={`Pico: ${peakHour.hora} ($${Number(peakHour.ventas).toLocaleString('es-CL')})`}
            size="small"
            sx={{
              backgroundColor: '#FBE9E7',
              color: '#8D3813',
              fontWeight: 700,
              fontSize: '0.74rem',
              borderRadius: '8px',
              border: '1px solid #FFCCBC',
              height: 26,
            }}
          />
        )}
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!hasData ? (
          <Typography variant="body2" sx={{ color: '#8C7A6F', textAlign: 'center' }}>
            No hay registros de ventas por hora para mostrar en esta jornada.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 15, right: 25, left: 15, bottom: 8 }}>
              <defs>
                <linearGradient id="coffeeVentasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C86237" stopOpacity={0.65} />
                  <stop offset="95%" stopColor="#C86237" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0E8E1" />
              <XAxis
                dataKey="hora"
                tickLine={false}
                axisLine={{ stroke: '#EFEAE6' }}
                tick={{ fill: '#8C7A6F', fontSize: 11.5 }}
                tickMargin={10}
                padding={{ left: 20, right: 20 }}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={55}
                tickMargin={8}
                tick={{ fill: '#8C7A6F', fontSize: 11.5 }}
                tickFormatter={(value) => (value === 0 ? '$0' : `$${(value / 1000).toFixed(0)}k`)}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="ventas"
                stroke="#C86237"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#coffeeVentasGradient)"
                dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#C86237', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#C86237', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
}

export default SalesChart;
