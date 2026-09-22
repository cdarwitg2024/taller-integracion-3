import { useState } from 'react';
import { Box, CssBaseline, Toolbar } from '@mui/material';

import Sidebar from './components/sidebar';
import Pedidos from './pages/pedidos';
import ScannerQr from './pages/scanner-qr';
import Dashboard from './pages/dashboard';

const drawerWidth = 240;

function App() {
  const [currentPage, setCurrentPage] = useState('pedidos');

  const renderPage = () => {
    switch (currentPage) {
      case 'pedidos':
        return <Pedidos />;

      case 'scanner-qr':
        return <ScannerQr />;

      case 'dashboard':
        return <Dashboard />;

      default:
        return <Pedidos />;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <CssBaseline />

      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />

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

        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;