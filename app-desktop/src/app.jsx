import { useState, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';

import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';

import Sidebar from './components/sidebar';
import RoleSelector from './pages/auth/RoleSelector';
import LoginDueno from './pages/dueno/LoginDueno';
import Dashboard from './pages/dueno/Dashboard';
import Productos from './pages/dueno/Productos';
import Inventario from './pages/dueno/Inventario';
import GestorPrecioStock from './pages/dueno/GestorPrecioStock';
import LoginEmpleado from './pages/empleado/LoginEmpleado';
import Comandas from './pages/empleado/Comandas';

const drawerWidth = 260;

// Layout compartido con Sidebar adaptado al rol y la ruta activa
function AuthenticatedLayout({ currentUser, onLogout, role, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isEmpleado = role === 'empleado';

  const duenoMenuItems = [
    {
      id: 'dashboard',
      path: '/dueno/dashboard',
      label: 'Dashboard',
      icon: <SpaceDashboardOutlinedIcon fontSize="small" />,
    },
    {
      id: 'productos',
      path: '/dueno/productos',
      label: 'Productos y Stock',
      icon: <MenuBookOutlinedIcon fontSize="small" />,
    },
    {
      id: 'inventario',
      path: '/dueno/inventario',
      label: 'Inventario',
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
  ];

  const empleadoMenuItems = [
    {
      id: 'comandas',
      path: '/empleado/comandas',
      label: 'Comandas',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#FAF7F5',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}
    >
      <CssBaseline />

      {/* Menú lateral reactivo a la URL actual */}
      <Sidebar
        currentPage={location.pathname}
        onNavigate={(path) => navigate(path)}
        onLogout={onLogout}
        menuItems={isEmpleado ? empleadoMenuItems : duenoMenuItems}
        subtitle={isEmpleado ? 'Terminal de Cocina' : 'Panel de Administración'}
        currentUser={currentUser}
      />

      {/* Contenedor principal de la página */}
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

// Guardia de ruta para proteger accesos no autorizados
function ProtectedRoute({ currentUser, isAuthenticated, requiredRole, children }) {
  if (!isAuthenticated || !currentUser) {
    return <Navigate to={requiredRole === 'empleado' ? '/login/empleado' : '/login/dueno'} replace />;
  }

  const userRole = (currentUser?.roles?.nombre || currentUser?.rol || '').toLowerCase();
  if (requiredRole && userRole !== requiredRole.toLowerCase()) {
    return <Navigate to={userRole === 'empleado' ? '/empleado/comandas' : '/dueno/dashboard'} replace />;
  }

  return children;
}

function App() {
  const navigate = useNavigate();

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

  const userRole = useMemo(() => {
    const rol = currentUser?.roles?.nombre || currentUser?.rol || 'dueño';
    return String(rol).toLowerCase();
  }, [currentUser]);

  const handleLoginDueno = (user) => {
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
    navigate('/dueno/dashboard');
  };

  const handleLoginEmpleado = (user) => {
    const activeUser = user || {
      id: 2,
      nombre: 'Juan',
      apellido: 'Empleado',
      email: 'empleado@coffeefaster.cl',
      roles: { nombre: 'empleado' },
      cafeteria_id: 1,
    };
    setCurrentUser(activeUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('coffeefaster_authenticated', 'true');
      localStorage.setItem('coffeefaster_user', JSON.stringify(activeUser));
    } catch {}
    navigate('/empleado/comandas');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem('coffeefaster_authenticated');
      localStorage.removeItem('coffeefaster_user');
    } catch {}
    // Regresa siempre al menú principal de selección
    navigate('/');
  };

  return (
    <>
      <CssBaseline />
      <Routes>
        {/* 1. Ruta Principal: Menú de selección de usuario (abre siempre como principal) */}
        <Route path="/" element={<RoleSelector />} />

        {/* 2. Login de Dueño (con URL /login/dueno y botón de regreso a /) */}
        <Route
          path="/login/dueno"
          element={
            <LoginDueno
              onLogin={handleLoginDueno}
              onBack={() => navigate('/')}
            />
          }
        />

        {/* 3. Login de Empleado (con URL /login/empleado y botón de regreso a /) */}
        <Route
          path="/login/empleado"
          element={
            <LoginEmpleado
              onLogin={handleLoginEmpleado}
              onBack={() => navigate('/')}
            />
          }
        />

        {/* 4. Rutas protegidas para Dueño (/dueno/*) */}
        <Route path="/dueno" element={<Navigate to="/dueno/dashboard" replace />} />

        <Route
          path="/dueno/dashboard"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <Dashboard currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dueno/productos"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <Productos currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/dueno/precios-stock" element={<Navigate to="/dueno/productos" replace />} />
        <Route path="/dueno/precio-stock" element={<Navigate to="/dueno/productos" replace />} />

        <Route
          path="/dueno/inventario"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <Inventario currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        {/* 5. Rutas protegidas para Empleado (/empleado/*) */}
        <Route path="/empleado" element={<Navigate to="/empleado/comandas" replace />} />

        <Route
          path="/empleado/comandas"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="empleado">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="empleado">
                <Comandas currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirección por defecto a la página principal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;