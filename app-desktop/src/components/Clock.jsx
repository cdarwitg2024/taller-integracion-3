import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

function formatHora(fecha) {
  const h24 = fecha.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')} ${ampm}`;
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