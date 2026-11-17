import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Afiliados({ currentUser }) {
  const navigate = useNavigate();
  const asignacion = currentUser?.cafeteria_id;
  const cafeteriaId = typeof asignacion === 'number' || typeof asignacion === 'string'
    ? Number(asignacion) : NaN;

  if (!Number.isSafeInteger(cafeteriaId) || cafeteriaId <= 0) {
    return (
      <Alert severity="warning">
        No hay una cafetería asignada a tu sesión. Contacta con el administrador para revisar tu acceso.
      </Alert>
    );
  }

  return (
    <Paper component="section" aria-label="Contexto de afiliados" variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h6">Afiliados de tu cafetería</Typography>
        <Chip label={`Cafetería #${cafeteriaId}`} variant="outlined" />
        <Typography variant="body2" color="text.secondary">
          Administra las campañas de carrito completo de tu cafetería y sus tasas de descuento y comisión.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dueno/afiliados/campanas')}>
          Administrar campañas
        </Button>
      </Stack>
    </Paper>
  );
}
