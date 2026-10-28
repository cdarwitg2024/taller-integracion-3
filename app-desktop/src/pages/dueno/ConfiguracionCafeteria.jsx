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
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Chip,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SaveIcon from '@mui/icons-material/Save';

import Button from '../components/Button';
import Input from '../components/Input';
import CardComponent from '../components/Card';
import { colors, spacing, typography } from '../theme';

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
    <Box sx={{ padding: spacing.lg }}>
      {/* Cabecera de la sección */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.lg }}>
        <SettingsOutlinedIcon sx={{ fontSize: 32, color: colors.cafeOscuro }} />
        <Box>
          <Typography variant="h5" fontWeight={typography.pesoBold} color={colors.cafeOscuro}>
            Configuración de Cafetería
          </Typography>
          <Typography variant="cuerpoPequeno" color={colors.textoSecundario}>
            Administra los datos generales de tu cafetería.
          </Typography>
        </Box>
      </Box>

      <CardComponent variant="elevated" padding="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Nombre de la Cafetería
            </Typography>
            <Input
              label="Nombre"
              placeholder="Cafetería Central"
              value={config.nombreCafeteria}
              onChangeText={handleChange('nombreCafeteria')}
            />
          </Box>

          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Dirección
            </Typography>
            <Input
              label="Dirección"
              placeholder="Av. Siempre Viva 123, Campus UCT"
              value={config.direccion}
              onChangeText={handleChange('direccion')}
            />
          </Box>

          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Teléfono
            </Typography>
            <Input
              label="Teléfono"
              placeholder="+56 2 2345 6789"
              value={config.telefono}
              onChangeText={handleChange('telefono')}
            />
          </Box>

          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Correo Electrónico
            </Typography>
            <Input
              label="Correo"
              placeholder="contacto@cafeteriacentral.cl"
              value={config.email}
              onChangeText={handleChange('email')}
            />
          </Box>

          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Hora de Apertura
            </Typography>
            <Input
              label="Hora"
              placeholder="07:00"
              value={config.horarioApertura}
              onChangeText={handleChange('horarioApertura')}
            />
          </Box>

          <Box>
            <Typography variant="cuerpoPequeno" color={colors.textoSecundario} mb={spacing.xs}>
              Hora de Cierre
            </Typography>
            <Input
              label="Hora"
              placeholder="20:00"
              value={config.horarioCierre}
              onChangeText={handleChange('horarioCierre')}
            />
          </Box>
        </Box>

        <Box sx={{ mt: spacing.lg, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={handleSave}>
            Guardar Cambios
          </Button>
        </Box>
      </CardComponent>
    </Box>
  );
}
