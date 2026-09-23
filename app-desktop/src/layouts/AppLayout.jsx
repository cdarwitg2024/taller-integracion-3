import { Box } from '@mui/material';
import Sidebar from '../components/sidebar';

const drawerWidth = 260;

function AppLayout({ currentPage, onNavigate, onLogout, menuItems, children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FAF7F5', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} onLogout={onLogout} menuItems={menuItems} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          p: { xs: 2.5, md: 4 },
          backgroundColor: '#FAF7F5',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default AppLayout;