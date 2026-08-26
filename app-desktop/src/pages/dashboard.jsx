import { Box, Typography } from '@mui/material';

function Dashboard() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        Dashboard
      </Typography>

      <Typography sx={{ mt: 2 }}>
        Dashboard próximamente.
      </Typography>
    </Box>
  );
}

export default Dashboard;

// Vista reservada para el Dashboard.
// Su implementación se realizará posteriormente.