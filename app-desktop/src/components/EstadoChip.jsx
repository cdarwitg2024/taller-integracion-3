import { Chip } from '@mui/material';

const configEstado = {
  pendiente: { label: 'Pendiente', color: 'error' },
  preparando: { label: 'En Preparación', color: 'warning' },
  listo: { label: 'Listo para Retiro', color: 'info' },
  entregado: { label: 'Entregado', color: 'success' },
};

function EstadoChip({ estado }) {
  const config = configEstado[estado] || { label: estado, color: 'default' };

  return (
    <Chip
      label={config.label}
      color={config.color}
      sx={{ minHeight: 32, fontWeight: 700 }}
    />
  );
}

export default EstadoChip;