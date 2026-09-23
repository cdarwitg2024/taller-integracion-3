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

import pedidosService from '../services/pedidosService';

const drawerWidth = 260;

function Sidebar({ currentPage, onNavigate, onLogout, menuItems }) {
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const updateCount = async () => {
      try {
        const pedidos = await pedidosService.getAll();
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
  }, []);

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
          backgroundColor: '#433225', // Fondo café oscuro de los prototipos
          color: '#FFFFFF',
          borderRight: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      }}
    >
      <Box>
        {/* Cabecera del Sidebar */}
        <Box sx={{ p: 3, pb: 2.5 }}>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{
              color: '#FFFFFF',
              letterSpacing: '-0.5px',
            }}
          >
            CoffeeFaster
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#C8B6A6',
              fontWeight: 600,
              letterSpacing: '0.4px',
              display: 'block',
              mt: 0.3,
            }}
          >
            Panel de Control
          </Typography>
        </Box>

        {/* Lista de navegación */}
        <Box sx={{ px: 1.5, mt: 1 }}>
          <List disablePadding>
            {items.map((item) => {
              const isActive = currentPage === item.id;
              const iconElement = item.id === 'pedidos' ? (
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
                  onClick={() => onNavigate(item.id)}
                  sx={{
                    mb: 1,
                    py: 1.3,
                    px: 2,
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#D0C0B4',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      color: '#FFFFFF',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.20)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#FFFFFF',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 38,
                      color: isActive ? '#FFFFFF' : '#C4B5A7',
                    }}
                  >
                    {iconElement}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.92rem',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Box>

      {/* Zona inferior con opción de cerrar sesión */}
      {onLogout && (
        <Box sx={{ px: 1.5, pb: 2.5 }}>
          <ListItemButton
            onClick={onLogout}
            sx={{
              py: 1.1,
              px: 2,
              borderRadius: '10px',
              color: '#C8B8AB',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: '#C8B8AB' }}>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Cerrar Sesión"
              primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: 500 }}
            />
          </ListItemButton>
        </Box>
      )}
    </Drawer>
  );
}

export default Sidebar;