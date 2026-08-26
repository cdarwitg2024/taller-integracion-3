import { Box, Typography } from '@mui/material';

function ScannerQr() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        Escáner QR
      </Typography>

      <Typography sx={{ mt: 2 }}>
        Escáner de códigos QR.
      </Typography>
    </Box>
  );
}

export default ScannerQr;

// Vista del escáner QR.
// La funcionalidad de escaneo se implementará posteriormente.