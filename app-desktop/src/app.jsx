import { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';

import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import PageHeader from './components/dueno/PageHeader';
import Login from './pages/auth/Login';
import Dashboard from './pages/dueno/Dashboard';
import Productos from './pages/dueno/Productos';
import Inventario from './pages/dueno/Inventario';
import BotDueno from './pages/dueno/BotDueno';
import GestorPrecioStock from './pages/dueno/GestorPrecioStock';
import LogsValidacion from './pages/dueno/LogsValidacion';
import Comandas from './pages/empleado/Comandas';
import StockEmpleado from './pages/empleado/Stock.jsx';
import { supabase } from './service/supabase';

// Layout compartido con Sidebar adaptado al rol y la ruta activa
import AppLayout from './layouts/AppLayout';

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
    {
      id: 'logs',
      path: '/dueno/logs',
      label: 'Logs de Validación',
      icon: <HistoryOutlinedIcon fontSize="small" />,
    },
    {
      id: 'bot',
      path: '/dueno/bot',
      label: 'Asistente Bot',
      icon: <SmartToyOutlinedIcon fontSize="small" />,
    },
  ];

  const empleadoMenuItems = [
    {
      id: 'comandas',
      path: '/empleado/comandas',
      label: 'Comandas',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    },
    {
      id: 'stock',
      path: '/empleado/stock',
      label: 'Stock',
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
  ];

  return (
    <AppLayout
      currentPage={location.pathname}
      onNavigate={(path) => navigate(path)}
      onLogout={onLogout}
      menuItems={isEmpleado ? empleadoMenuItems : duenoMenuItems}
      subtitle={isEmpleado ? 'Terminal de Cocina' : 'Panel de Administración'}
      currentUser={currentUser}
      headerElement={!isEmpleado ? buildDuenoHeader(location.pathname) : null}
    >
      <CssBaseline />
      {children}
    </AppLayout>
  );
};

/**
 * Cabecera (título + subtítulo) de cada pantalla del panel de dueño.
 * Recibe `pathname` del `useLocation()` de AuthenticatedLayout: la ruta real
 * vive en el hash (`#/dueno/dashboard`), por lo que `location` global de
 * `window` no sirve aquí.
 */
function buildDuenoHeader(pathname) {
  const duenoPageHeaders = {
    '/dueno/dashboard': {
      title: 'Dashboard Central',
      subtitle: 'Métricas en tiempo real, pedidos activos y rendimiento de ventas de la cafetería.',
    },
    '/dueno/productos': {
      title: 'Productos y Stock',
      subtitle: 'Administra el catálogo de productos, precios y disponibilidad de la cafetería.',
    },
    '/dueno/inventario': {
      title: 'Inventario',
      subtitle: 'Control de stock de insumos y alertas de productos por debajo del mínimo.',
    },
    '/dueno/logs': {
      title: 'Logs de Validación QR/Token',
      subtitle: 'Registro de entregas y rechazos verificados por código QR o Token.',
    },
    '/dueno/bot': {
      title: 'Asistente Bot del Dueño',
      subtitle: 'Consola interactiva del Bot CoffeeFaster, diagnóstico de servicio y consultas de existencias.',
    },
  };

  const headerInfo = duenoPageHeaders[pathname];
  if (!headerInfo) return null;

  return (
    <PageHeader
      title={headerInfo.title}
      subtitle={headerInfo.subtitle}
    />
  );
}

// Guardia de ruta para proteger accesos no autorizados
function ProtectedRoute({ currentUser, isAuthenticated, requiredRole, children }) {
  if (!isAuthenticated || !currentUser) {
    // Sin sesión se vuelve al login unificado (ahora no hay selección de rol).
    return <Navigate to="/" replace />;
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

  // Sincronización de sesión con Supabase Auth en el arranque
  useEffect(() => {
    let isMounted = true;
    const syncSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && isMounted) {
          // Si Supabase no tiene sesión activa válida, limpiar estado
          const storedAuth = localStorage.getItem('coffeefaster_authenticated');
          if (storedAuth === 'true') {
            setIsAuthenticated(false);
            setCurrentUser(null);
            localStorage.removeItem('coffeefaster_authenticated');
            localStorage.removeItem('coffeefaster_user');
          }
        }
      } catch (err) {
        console.warn('Error al verificar sesión activa en Supabase:', err);
      }
    };
    syncSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const userRole = useMemo(() => {
    const rol = currentUser?.roles?.nombre || currentUser?.rol || 'dueño';
    return String(rol).toLowerCase();
  }, [currentUser]);

  // Handler único de login: el rol ya viene resuelto desde el backend
  // (usuarios.login) y decide a qué panel enrutar sin selección manual.
  const handleLogin = (user) => {
    if (!user) return;
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('coffeefaster_authenticated', 'true');
      localStorage.setItem('coffeefaster_user', JSON.stringify(user));
    } catch {}
    const rol = String(user?.roles?.nombre || user?.rol || '').toLowerCase();
    navigate(rol === 'empleado' ? '/empleado/comandas' : '/dueno/dashboard');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error cerrando sesión en Supabase:', err);
    }
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
        {/* 1. Ruta Principal: Login unificado de escritorio (sin selección de rol) */}
        <Route path="/" element={<Login onLogin={handleLogin} />} />

        {/* URLs de login anteriores: redirigen al login unificado */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/login/dueno" element={<Navigate to="/" replace />} />
        <Route path="/login/empleado" element={<Navigate to="/" replace />} />

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

        <Route
          path="/dueno/logs"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <LogsValidacion currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dueno/bot"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <BotDueno currentUser={currentUser} />
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

        <Route
          path="/empleado/stock"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="empleado">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="empleado">
                <StockEmpleado currentUser={currentUser} />
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