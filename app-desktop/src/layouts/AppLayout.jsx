import { Box, Toolbar } from '@mui/material';

import Sidebar from '../components/sidebar';

const drawerWidth = 240;

const pages = [
  { id: 'pedidos', label: 'Comandas' },
  { id: 'scanner-qr', label: 'Escáner QR' },
  { id: 'dashboard', label: 'Dashboard' },
];

function AppLayout({ currentPage, onNavigate, children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} menuItems={pages} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${drawerWidth}px)`,
          p: 4,
          backgroundColor: '#f8fafc',
          minHeight: '100vh',
        }}
      >
        <Toolbar />

        {children}
      </Box>
    </Box>
  );
}

export default AppLayout;