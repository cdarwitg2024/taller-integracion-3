import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

function formatHora(fecha) {
  const h24 = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${h24}:${min}`;
}

function Clock({ sx }) {
  const [hora, setHora] = useState(() => formatHora(new Date()));

  useEffect(() => {
    const interval = setInterval(() => setHora(formatHora(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Typography
      variant="h4"
      component="span"
      fontWeight={800}
      sx={{
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        ...sx,
      }}
    >
      {hora}
    </Typography>
  );
}

export default Clock;