import { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';

import Sidebar from './components/sidebar';
import Dashboard from './pages/dashboard';
import Productos from './pages/productos';
import Inventario from './pages/inventario';
import Login from './pages/login';

const drawerWidth = 260;

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('coffeefaster_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('coffeefaster_authenticated') === 'true');
  });

  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (user) => {
    const activeUser = user || {
      id: 1,
      nombre: 'Carlos',
      apellido: 'Dueño',
      email: 'dueno@coffeefaster.cl',
      roles: { nombre: 'dueño' },
      cafeteria_id: 1,
    };
    setCurrentUser(activeUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('coffeefaster_authenticated', 'true');
      localStorage.setItem('coffeefaster_user', JSON.stringify(activeUser));
    } catch {}
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem('coffeefaster_authenticated');
      localStorage.removeItem('coffeefaster_user');
    } catch {}
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
        return <Dashboard currentUser={currentUser} />;

      case 'productos':
        return <Productos currentUser={currentUser} />;

      case 'inventario':
        return <Inventario currentUser={currentUser} />;

      default:
        return <Dashboard currentUser={currentUser} />;
    }
  };


  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FAF7F5', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
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
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
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