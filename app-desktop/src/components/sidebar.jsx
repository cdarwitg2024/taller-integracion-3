import { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Badge,
} from '@mui/material';

import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import pedidosService from '../services/pedidosService';
import { drawerWidth, kdsColors } from '../theme/theme';

function Sidebar({ currentPage, onNavigate, onLogout, menuItems, subtitle = 'Panel de Control', currentUser }) {
  const [pendientesCount, setPendientesCount] = useState(0);

  // S2-T18: `pedidosService.getAll` exige la cafetería autorizada desde
  // S2-T12. El badge de pedidos activos debe consultar solo la del usuario.
  const cafeteriaId =
    currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? null;

  useEffect(() => {
    let isMounted = true;

    if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
      setPendientesCount(0);
      return undefined;
    }

    const updateCount = async () => {
      try {
        const pedidos = await pedidosService.getAll({ cafeteriaId });
        if (isMounted && Array.isArray(pedidos)) {
          const count = pedidos.filter(
            (p) => p.estado === 'pendiente' || p.estado === 'preparando'
          ).length;
          setPendientesCount(count);
        }
      } catch (err) {
        // Silently ignore
      }
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cafeteriaId]);

  const defaultMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <SpaceDashboardOutlinedIcon fontSize="small" />,
    },
    {
      id: 'pedidos',
      label: 'Comandas',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    },
    {
      id: 'productos',
      label: 'Productos',
      icon: <MenuBookOutlinedIcon fontSize="small" />,
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
    {
      id: 'bot',
      label: 'Asistente Bot',
      icon: <SmartToyOutlinedIcon fontSize="small" />,
    },
  ];

  const items = menuItems || defaultMenuItems;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: kdsColors.sidebar, // Fondo café oscuro de los prototipos
          color: kdsColors.onDark,
          borderRight: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      }}
    >
      <Box>
        {/* Cabecera del Sidebar */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{
              color: kdsColors.onDark,
              letterSpacing: '-0.5px',
            }}
          >
            CoffeeFast
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: kdsColors.onDarkMuted,
              fontWeight: 600,
              letterSpacing: '0.4px',
              display: 'block',
              mt: 0.3,
            }}
          >
            {subtitle}
          </Typography>
        </Box>

        {/* Lista de navegación */}
        <Box sx={{ px: 1.5, mt: 1 }}>
          <List disablePadding>
            {items.map((item) => {
              const itemTarget = item.path || item.id;
              const isActive = currentPage === itemTarget || (item.path && currentPage.startsWith(item.path));
              const isComandas = item.id === 'pedidos' || item.id === 'comandas' || String(itemTarget).includes('comandas');
              const iconElement = isComandas ? (
                <Badge badgeContent={pendientesCount} color="error" max={99}>
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              );

              return (
                <ListItemButton
                  key={item.id}
                  selected={isActive}
                  onClick={() => onNavigate(itemTarget)}
                  sx={{
                    mb: 1,
                    py: 1.3,
                    px: 2,
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    color: isActive ? kdsColors.onDark : kdsColors.onDarkSoft,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      color: kdsColors.onDark,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.20)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: kdsColors.onDark,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 38,
                      color: isActive ? kdsColors.onDark : kdsColors.onDarkSoft,
                    }}
                  >
                    {iconElement}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        fontSize: '0.92rem',
                        fontWeight: isActive ? 700 : 500,
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Box>

      {/* Zona inferior con opción de cerrar sesión */}
      <Box sx={{ px: 1.5, pb: 2.5 }}>
        {currentUser && (
          <Box
            sx={{
              p: 1.5,
              mb: 1.5,
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: kdsColors.onDark,
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentUser.nombre} {currentUser.apellido || ''}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: kdsColors.onDarkMuted,
                fontSize: '0.72rem',
                textTransform: 'capitalize',
                display: 'block',
              }}
            >
              {currentUser.roles?.nombre || 'Usuario'}
            </Typography>
          </Box>
        )}

        {onLogout && (
          <ListItemButton
            onClick={onLogout}
            sx={{
              py: 1.1,
              px: 2,
              borderRadius: '10px',
              color: kdsColors.onDarkMuted,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: kdsColors.onDark,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: kdsColors.onDarkMuted }}>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Cerrar Sesión"
              slotProps={{ primary: { fontSize: '0.88rem', fontWeight: 500 } }}
            />
          </ListItemButton>
        )}
      </Box>
    </Drawer>
  );
}

export default Sidebar;