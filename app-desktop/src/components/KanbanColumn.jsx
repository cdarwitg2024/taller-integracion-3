import { Box, Chip, Typography } from '@mui/material';
import { kdsColors } from '../theme/theme';

function KanbanColumn({ titulo, count, backgroundColor, headerColor = kdsColors.header, children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor,
        borderRadius: 3,
        border: `1px solid ${kdsColors.border}`,
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
          py: 1.5,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h4"
          fontWeight={800}
          noWrap
          sx={{
            color: headerColor,
            fontSize: { xs: '1.5rem', sm: '1.7rem', md: '1.85rem' },
            letterSpacing: '-0.3px',
          }}
        >
          {titulo}
        </Typography>
        <Chip
          label={count}
          size="medium"
          sx={{ minWidth: 48, minHeight: 48, fontSize: '1.2rem', fontWeight: 900 }}
        />
      </Box>

      <Box sx={{ px: 2, pb: 2, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

export default KanbanColumn;
