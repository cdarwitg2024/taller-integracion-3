import { useEffect, useState } from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Badge,
} from '@mui/material';

import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import DashboardIcon from '@mui/icons-material/Dashboard';

import pedidosService from '../services/pedidosService';

const drawerWidth = 240;

function Sidebar({ currentPage, onNavigate }) {
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const pedidos = await pedidosService.getAll();
      const count = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'preparando').length;
      setPendientesCount(count);
    };
    updateCount();
    const interval = setInterval(updateCount, 4000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: (
        <Badge badgeContent={pendientesCount} color="error">
          <ReceiptLongIcon />
        </Badge>
      ),
    },
    {
      id: 'scanner-qr',
      label: 'Escáner QR',
      icon: <QrCodeScannerIcon />,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
        },
      }}
    >
      <Toolbar sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="h6" fontWeight={800} color="#38bdf8">
          ☕ CoffeeFaster
        </Typography>
      </Toolbar>

      <Box sx={{ overflow: 'auto', mt: 2 }}>
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.id}
              selected={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  '& .MuiListItemIcon-root': {
                    color: '#ffffff',
                  },
                  '&:hover': {
                    backgroundColor: '#0369a1',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <ListItemIcon sx={{ color: currentPage === item.id ? '#ffffff' : '#94a3b8' }}>
                {item.icon}
              </ListItemIcon>

              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: currentPage === item.id ? 700 : 500 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;