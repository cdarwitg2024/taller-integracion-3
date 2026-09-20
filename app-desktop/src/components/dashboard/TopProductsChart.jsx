import { Paper, Typography, Box } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function TopProductsChart({ data }) {
  const defaultData = [
    { nombre: 'Café Americano', cantidad: 48 },
    { nombre: 'Capuchino', cantidad: 41 },
    { nombre: 'Sándwich Ave', cantidad: 35 },
    { nombre: 'Croissant J&Q', cantidad: 29 },
    { nombre: 'Muffin Arándano', cantidad: 22 },
  ];

  const chartData = data && data.length > 0 ? data : defaultData;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '16px',
        border: '1px solid #EFEAE6',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
        height: 380,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#4A3728', fontSize: '1.1rem' }}>
          Productos Más Populares
        </Typography>
        <Typography variant="caption" sx={{ color: '#8C7A6F' }}>
          Unidades preparadas durante la jornada de hoy
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0E8E1" />
            <XAxis type="number" tick={{ fill: '#8C7A6F', fontSize: 12 }} />
            <YAxis
              dataKey="nombre"
              type="category"
              tick={{ fill: '#4A3728', fontSize: 12, fontWeight: 500 }}
              width={110}
            />
            <Tooltip
              formatter={(value) => [`${value} unidades`, 'Vendidas']}
              contentStyle={{
                backgroundColor: '#4A3728',
                borderRadius: '8px',
                border: 'none',
                color: '#FFFFFF',
              }}
            />
            <Bar dataKey="cantidad" fill="#7A563D" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

export default TopProductsChart;
