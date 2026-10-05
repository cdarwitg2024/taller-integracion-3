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
        <Typography variant="h4" fontWeight={800} sx={{ color: headerColor, fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' } }}>
          {titulo}
        </Typography>
        <Chip
          label={count}
          size="medium"
          sx={{ minWidth: 52, minHeight: 52, fontSize: '1.25rem', fontWeight: 900 }}
        />
      </Box>

      <Box sx={{ px: 2, pb: 2, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

export default KanbanColumn;