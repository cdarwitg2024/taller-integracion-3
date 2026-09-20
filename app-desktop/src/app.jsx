import { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';

import Sidebar from './components/sidebar';
import Dashboard from './pages/dashboard';
import Productos from './pages/productos';
import Inventario from './pages/inventario';
import Login from './pages/login';

const drawerWidth = 260;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Si no está autenticado, muestra la pantalla de Login Dueño
  if (!isAuthenticated) {
    return (
      <>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;

      case 'productos':
        return <Productos />;

      case 'inventario':
        return <Inventario />;

      default:
        return <Dashboard />;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FAF7F5' }}>
      <CssBaseline />

      {/* 1. Sidebar / Menú exclusivo de Dueño */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
      />

      {/* Contenedor principal para las páginas del Panel de Dueño */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${drawerWidth}px)`,
          p: { xs: 2.5, md: 4 },
          backgroundColor: '#FAF7F5',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;