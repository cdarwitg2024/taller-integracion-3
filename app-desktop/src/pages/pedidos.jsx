import { Box, Typography } from '@mui/material';

function Pedidos() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        Pedidos
      </Typography>

      <Typography sx={{ mt: 2 }}>
        Panel de pedidos y KDS.
      </Typography>
    </Box>
  );
}

export default Pedidos;

// Vista principal de Pedidos.
// Será utilizada posteriormente como interfaz KDS.