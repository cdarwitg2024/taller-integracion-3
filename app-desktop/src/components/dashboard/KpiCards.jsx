import { Grid, Card, CardContent, Typography, Stack, Box } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

function KpiCards({ stats }) {
  const cards = [
    {
      title: 'Ventas del Día',
      value: `$${(stats?.totalVentas || 0).toLocaleString('es-CL')}`,
      subtitle: '+14% respecto a ayer',
      icon: <AttachMoneyIcon sx={{ fontSize: 32, color: '#2E7D32' }} />,
      iconBg: '#E8F5E9',
      borderColor: '#2E7D32',
    },
    {
      title: 'Total Pedidos',
      value: stats?.totalPedidos || 0,
      subtitle: 'Registrados en el turno',
      icon: <ShoppingBagIcon sx={{ fontSize: 30, color: '#4A3728' }} />,
      iconBg: '#F5EBE1',
      borderColor: '#4A3728',
    },
    {
      title: 'Pendientes / En Prep.',
      value: (stats?.pendientes || 0) + (stats?.preparando || 0),
      subtitle: `${stats?.pendientes || 0} pendientes • ${stats?.preparando || 0} en prep.`,
      icon: <PendingActionsIcon sx={{ fontSize: 30, color: '#C86237' }} />,
      iconBg: '#FBE9E7',
      borderColor: '#C86237',
    },
    {
      title: 'Tiempo Prom. Prep.',
      value: `${stats?.tiempoPromedioMin || 6.5} min`,
      subtitle: 'Promedio de entrega rápida',
      icon: <AccessTimeIcon sx={{ fontSize: 30, color: '#8D6E63' }} />,
      iconBg: '#EFEBE9',
      borderColor: '#8D6E63',
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            elevation={0}
            sx={{
              borderRadius: '16px',
              border: '1px solid #EFEAE6',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 10px rgba(74, 55, 40, 0.04)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(74, 55, 40, 0.08)',
              },
            }}
          >
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ color: '#8C7A6F', textTransform: 'uppercase', letterSpacing: '0.6px' }}
                  >
                    {card.title}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{ color: '#3B291D', mt: 0.8, letterSpacing: '-0.5px' }}
                  >
                    {card.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9E8D82', mt: 0.5, display: 'block' }}>
                    {card.subtitle}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: card.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default KpiCards;
