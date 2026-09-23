import { Paper, Typography, Box } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function SalesChart({ salesData }) {
  const defaultData = [
    { hora: '08:00', ventas: 12400, pedidos: 5 },
    { hora: '09:00', ventas: 28500, pedidos: 12 },
    { hora: '10:00', ventas: 42000, pedidos: 18 },
    { hora: '11:00', ventas: 31000, pedidos: 14 },
    { hora: '12:00', ventas: 54000, pedidos: 22 },
    { hora: '13:00', ventas: 68000, pedidos: 29 },
    { hora: '14:00', ventas: 38000, pedidos: 15 },
    { hora: '15:00', ventas: 26000, pedidos: 11 },
  ];

  const data = salesData && salesData.length > 0 ? salesData : defaultData;

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
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#4A3728', fontSize: '1.1rem' }}>
          Tendencia de Ventas por Hora
        </Typography>
        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
          Flujo de facturación acumulado en pesos chilenos ($ CLP)
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="coffeeVentasGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C86237" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#C86237" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0E8E1" />
            <XAxis
              dataKey="hora"
              tickLine={false}
              axisLine={{ stroke: '#EFEAE6' }}
              tick={{ fill: '#8C7A6F', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8C7A6F', fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString('es-CL')}`, 'Ventas']}
              contentStyle={{
                backgroundColor: '#4A3728',
                borderRadius: '8px',
                border: 'none',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              itemStyle={{ color: '#F5EBE1' }}
              labelStyle={{ color: '#E0D2C7', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="ventas"
              stroke="#C86237"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#coffeeVentasGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

export default SalesChart;
