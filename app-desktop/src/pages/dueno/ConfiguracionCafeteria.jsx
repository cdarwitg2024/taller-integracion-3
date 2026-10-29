// ─── Pantalla: Configuración de Cafetería (Panel Dueño) ───────────────────────
// Permite administrar los datos generales de la cafetería (nombre, horario,
// contacto, etc.). Es parte del panel de administración del dueño.
//
// Flujo:
//   1. app.jsx define la ruta /dueno/configuracion y el ítem del menú.
//   2. Sidebar renderiza el ítem "Configuración de Cafetería".
//   3. Al hacer clic, se renderiza este componente dentro de AppLayout.
//   4. AppLayout inyecta automáticamente el header consistente.

import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

import BaseButton from '../../components/ui/BaseButton';
import Input from '../../components/ui/BaseInput';
import CardComponent from '../../components/ui/BaseCard';
import { COLORS, SPACING, TYPOGRAPHY } from '../../design/tokens';

export default function ConfiguracionCafeteria({ currentUser }) {
  const [config, setConfig] = useState({
    nombreCafeteria: 'Cafetería Central',
    direccion: 'Av. Siempre Viva 123, Campus UCT',
    telefono: '+56 2 2345 6789',
    email: 'contacto@cafeteriacentral.cl',
    horarioApertura: '07:00',
    horarioCierre: '20:00',
  });

  const handleChange = (key) => (e) => {
    setConfig({ ...config, [key]: e.target.value });
  };

  const handleSave = () => {
    // Aquí se enviaría la actualización al backend
    alert('Configuración guardada correctamente.');
  };

  return (
    <Box sx={{ padding: SPACING.sm, maxWidth: '950px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Tarjeta contenedora centrada y compacta */}
      <CardComponent variant="outlined" padding="md">
        
        {/* Grilla compacta de inputs (3 arriba, 3 abajo) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: SPACING.md, mb: SPACING.md, mt: 0.5 }}>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Nombre de la Cafetería
            </Typography>
            <Input
              placeholder="Cafetería Central"
              value={config.nombreCafeteria}
              onChange={(e) => setConfig({ ...config, nombreCafeteria: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Dirección
            </Typography>
            <Input
              placeholder="Av. Siempre Viva 123, Campus UCT"
              value={config.direccion}
              onChange={(e) => setConfig({ ...config, direccion: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Teléfono
            </Typography>
            <Input
              placeholder="+56 2 2345 6789"
              value={config.telefono}
              onChange={(e) => setConfig({ ...config, telefono: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Correo Electrónico
            </Typography>
            <Input
              placeholder="contacto@cafeteriacentral.cl"
              value={config.email}
              onChange={(e) => setConfig({ ...config, email: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Hora de Apertura
            </Typography>
            <Input
              placeholder="07:00"
              value={config.horarioApertura}
              onChange={(e) => setConfig({ ...config, horarioApertura: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color={COLORS.textPrimary} sx={{ fontSize: '0.85rem' }}>
              Hora de Cierre
            </Typography>
            <Input
              placeholder="20:00"
              value={config.horarioCierre}
              onChange={(e) => setConfig({ ...config, horarioCierre: e.target.value })}
            />
          </Box>

        </Box>

        {/* Botón inferior alineado */}
        <Box sx={{ pt: SPACING.xs, borderTop: `1px solid rgba(0, 0, 0, 0.06)`, display: 'flex', justifyContent: 'flex-end' }}>
          <BaseButton variant="contained" color="primary" size="sm" startIcon={<SaveIcon />} onClick={handleSave}>
            Guardar Cambios
          </BaseButton>
        </Box>

      </CardComponent>
    </Box>
  );
}