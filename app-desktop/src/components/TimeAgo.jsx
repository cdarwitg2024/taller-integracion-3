import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { parsearFecha } from '../utils/dateUtils';
import { COLORS } from '../design/tokens';

function parseInicio(pedido) {
  if (pedido.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) return fecha.getTime();
  }
  if (pedido.hora) {
    const hoy = new Date();
    const partes = pedido.hora.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (partes) {
      let h = Number(partes[1]);
      const m = Number(partes[2]);
      const ampm = (partes[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      const candidata = new Date(hoy);
      candidata.setHours(h, m, 0, 0);
      if (candidata.getTime() <= Date.now()) return candidata.getTime();
    }
  }
  return Date.now();
}

/**
 * Tiempo transcurrido desde que entró el pedido.
 * Formato compacto para la tarjeta del KDS:
 *   - menos de 1 hora → "MM:SS"
 *   - 1 hora o más    → "H:MM h"
 */
function formatTimeAgo(inicio) {
  const segundos = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;

  if (horas > 0) return `${horas}:${String(minutos).padStart(2, '0')} h`;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

function TimeAgo({ pedido, sx }) {
  const [inicio] = useState(() => parseInicio(pedido));
  const [texto, setTexto] = useState(() => formatTimeAgo(inicio));

  useEffect(() => {
    const interval = setInterval(() => setTexto(formatTimeAgo(inicio)), 1000);
    return () => clearInterval(interval);
  }, [inicio]);

  return (
    <Typography
      fontWeight={800}
      sx={{
        color: COLORS.textPrimary,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        ...sx,
      }}
    >
      ⏱️ {texto}
    </Typography>
  );
}

export default TimeAgo;