import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

export default function Afiliados({ currentUser }) {
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
          La gestión de campañas y solicitudes de afiliación estará disponible próximamente.
        </Typography>
      </Stack>
    </Paper>
  );
}
