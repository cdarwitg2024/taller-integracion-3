import { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';

import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import PageHeader from './components/dueno/PageHeader';
import Promociones from './pages/dueno/Promociones';
import ConfiguracionCafeteria from './pages/dueno/ConfiguracionCafeteria';
import Login from './pages/auth/Login';
import AccesoNoAutorizado from './components/AccesoNoAutorizado';
import Dashboard from './pages/dueno/Dashboard';
import Productos from './pages/dueno/Productos';
import Inventario from './pages/dueno/Inventario';
import SolicitudesReposicion from './pages/dueno/SolicitudesReposicion';
import BotDueno from './pages/dueno/BotDueno';
import GestorPrecioStock from './pages/dueno/GestorPrecioStock';
import LogsValidacion from './pages/dueno/LogsValidacion';
import Comandas from './pages/empleado/Comandas';
import StockEmpleado from './pages/empleado/Stock.jsx';
import { supabase } from './service/supabase';
import { usuarios } from './service/usuarios';

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
      id: 'solicitudes-reposicion',
      path: '/dueno/solicitudes-reposicion',
      label: 'Solicitudes de Reposición',
      icon: <AssignmentOutlinedIcon fontSize="small" />,
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
    {
      id: 'promociones',
      path: '/dueno/promociones',
      label: 'Promociones',
      icon: <LocalOfferOutlinedIcon fontSize="small" />,
    },
    {
      id: 'configuracion',
      path: '/dueno/configuracion',
      label: 'Configuración de Cafetería',
      icon: <SettingsOutlinedIcon fontSize="small" />,
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
    '/dueno/solicitudes-reposicion': {
      title: 'Solicitudes de Reposición',
      subtitle: 'Consulta de solo lectura de las solicitudes de reposición generadas por los empleados de tu cafetería.',
    },
    '/dueno/logs': {
      title: 'Logs de Validación QR/Token',
      subtitle: 'Registro de entregas y rechazos verificados por código QR o Token.',
    },
    '/dueno/bot': {
      title: 'Asistente Bot del Dueño',
      subtitle: 'Consola interactiva del Bot CoffeeFaster, diagnóstico de servicio y consultas de existencias.',
    },
    '/dueno/promociones': {
      title: 'Promociones',
      subtitle: 'Administra las promociones vigentes de la cafetería.',
    },
    '/dueno/configuracion': {
      title: 'Configuración de Cafetería',
      subtitle: 'Administra los datos generales de tu cafetería.',
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
// Normaliza el rol del usuario y solo reconoce los dos roles válidos del
// sistema (dueño y empleado). Cualquier otro valor (vacío, "admin", "cajero",
// etc.) se considera un rol no válido y devuelve null.
function rolNormalizado(rol) {
  const r = String(rol || '').trim().toLowerCase();
  if (r === 'empleado') return 'empleado';
  if (r === 'dueño' || r === 'dueno') return 'dueño';
  return null;
}

// Ruta destino según el rol real del usuario. Si el rol no es válido no hay
// destino (null), para tratarlo como acceso no autorizado en vez de asumir un
// panel por defecto.
function destinoPorRol(rol) {
  const r = rolNormalizado(rol);
  if (r === 'empleado') return '/empleado/comandas';
  if (r === 'dueño') return '/dueno/dashboard';
  return null;
}

function ProtectedRoute({ currentUser, isAuthenticated, requiredRole, children }) {
  if (!isAuthenticated || !currentUser) {
    // Sin sesión se vuelve al login unificado (ahora no hay selección de rol).
    return <Navigate to="/" replace />;
  }

  const rol = rolNormalizado(currentUser?.roles?.nombre || currentUser?.rol);

  // Rol inválido o sin autorización: no se redirige a ningún panel (eso
  // provocaría un bucle infinito) y se muestra la pantalla de acceso no
  // autorizado.
  if (!rol) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  // Rol válido pero de otra sección: se lleva al panel que le corresponde.
  const requerido = rolNormalizado(requiredRole);
  if (requerido && rol !== requerido) {
    return <Navigate to={destinoPorRol(rol)} replace />;
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
        if (!isMounted) return;

        // Sin sesión de Supabase: limpiar el estado guardado en el cliente.
        if (!session) {
          const storedAuth = localStorage.getItem('coffeefaster_authenticated');
          if (storedAuth === 'true') {
            setIsAuthenticated(false);
            setCurrentUser(null);
            localStorage.removeItem('coffeefaster_authenticated');
            localStorage.removeItem('coffeefaster_user');
          }
          return;
        }

        // Con sesión activa se re-consulta el rol REAL desde la base de datos
        // para no confiar solo en localStorage (evita que una sesión conserve
        // un rol cambiado o datos manipulados en el cliente).
        const perfil = await usuarios.getPerfilSesion();
        if (!isMounted) return;

        if (perfil?.success) {
          setCurrentUser(perfil.user);
          try {
            localStorage.setItem('coffeefaster_user', JSON.stringify(perfil.user));
          } catch {}
          // Si el rol ya no es válido, la cuenta queda sin autorización.
          if (!destinoPorRol(perfil.rol)) {
            setIsAuthenticated(false);
            setCurrentUser(null);
            try {
              localStorage.removeItem('coffeefaster_authenticated');
              localStorage.removeItem('coffeefaster_user');
            } catch {}
            await supabase.auth.signOut();
          }
        } else if (perfil?.fatal) {
          // Respuesta definitiva (sin perfil en la BD o sin sesión): cerrar.
          setIsAuthenticated(false);
          setCurrentUser(null);
          try {
            localStorage.removeItem('coffeefaster_authenticated');
            localStorage.removeItem('coffeefaster_user');
          } catch {}
          if (perfil.error === 'perfil_no_encontrado') {
            await supabase.auth.signOut();
          }
        }
        // Si no es definitivo (p. ej. error de red), se mantiene la sesión.
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
    // Sin un rol explícito no se asume ninguno (antes asumía 'dueño', lo que
    // daba acceso al panel de dueño a cuentas sin rol asignado).
    const rol = currentUser?.roles?.nombre || currentUser?.rol || '';
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
    const destino = destinoPorRol(user?.roles?.nombre || user?.rol);
    // Si el rol no es válido (no debería pasar: el login ya lo valida), se va
    // a la pantalla de acceso no autorizado en vez de asumir un panel.
    navigate(destino || '/acceso-denegado');
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
        {/* 1. Ruta Principal: login unificado; si ya hay sesión iniciada, se
            redirige automáticamente al panel que corresponde según el rol real
            del usuario (empleado → KDS, dueño → panel administrativo). */}
        <Route
          path="/"
          element={
            isAuthenticated && currentUser
              ? (destinoPorRol(userRole)
                  ? <Navigate to={destinoPorRol(userRole)} replace />
                  : <Navigate to="/acceso-denegado" replace />)
              : <Login onLogin={handleLogin} />
          }
        />

        {/* Pantalla de acceso no autorizado (rol inválido o sin autorización) */}
        <Route path="/acceso-denegado" element={<AccesoNoAutorizado onLogout={handleLogout} />} />

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
          path="/dueno/solicitudes-reposicion"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <SolicitudesReposicion currentUser={currentUser} />
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

        <Route
          path="/dueno/promociones"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <Promociones currentUser={currentUser} />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dueno/configuracion"
          element={
            <ProtectedRoute currentUser={currentUser} isAuthenticated={isAuthenticated} requiredRole="dueño">
              <AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} role="dueño">
                <ConfiguracionCafeteria currentUser={currentUser} />
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