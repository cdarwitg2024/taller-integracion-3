import { Box, Chip, Typography } from '@mui/material';

function KanbanColumn({ titulo, count, backgroundColor, headerColor = '#4A3B32', children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor,
        borderRadius: 3,
        border: '1px solid #EFEAE6',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2.5,
          py: 2,
          flexShrink: 0,
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ color: headerColor }}>
          {titulo}
        </Typography>
        <Chip
          label={count}
          size="medium"
          sx={{ minWidth: 48, minHeight: 48, fontSize: '1.05rem', fontWeight: 800 }}
        />
      </Box>

      <Box sx={{ px: 2, pb: 2, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

export default KanbanColumn;