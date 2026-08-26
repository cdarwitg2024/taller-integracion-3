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
    <Box sx={{ display: 'flex' }}>
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
        }}
      >
        <Toolbar />

        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;

// Componente raíz de la aplicación.
// Define la estructura general y la navegación principal.