import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

function parseInicio(pedido) {
  if (pedido.creado_en) {
    const fecha = new Date(pedido.creado_en);
    if (!Number.isNaN(fecha.getTime())) return fecha.getTime();
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

function formatTimeAgo(inicio) {
  const segundos = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
  const mm = Math.floor(segundos / 60);
  const ss = segundos % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
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
        color: '#4A3B32',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        ...sx,
      }}
    >
      ⏱️ {texto} min
    </Typography>
  );
}

export default TimeAgo;