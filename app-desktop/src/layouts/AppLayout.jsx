import { Box } from '@mui/material';
import Sidebar from '../components/sidebar';
import { kdsColors } from '../theme/theme';

/**
 * Layout base del escritorio: sidebar fijo a la izquierda + área de contenido.
 *
 * El shell mide exactamente 100vh y `<main>` es el único contenedor con scroll.
 * Así las pantallas del KDS reparten el alto disponible con `height: 100%` en
 * lugar de restar píxeles a mano (antes se usaba `calc(100vh - 128px)`, que se
 * rompía al cambiar el padding o la altura del header).
 *
 * `headerElement` (opcional) se renderiza encima de `children`: lo usa
 * `app.jsx` para mostrar la cabecera de las pantallas del panel de dueño.
 */
function AppLayout({ currentPage, onNavigate, onLogout, menuItems, subtitle, currentUser, children, headerElement }) {
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        backgroundColor: kdsColors.canvas,
      }}
    >
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        menuItems={menuItems}
        subtitle={subtitle}
        currentUser={currentUser}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
          p: { xs: 2.5, md: 4 },
          backgroundColor: kdsColors.canvas,
          boxSizing: 'border-box',
        }}
      >
        {headerElement && (
          <Box sx={{ mb: 3 }}>{headerElement}</Box>
        )}
        {children}
      </Box>
    </Box>
  );
}

export default AppLayout;
