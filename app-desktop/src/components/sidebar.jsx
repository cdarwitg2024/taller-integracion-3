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

const iconosPorSeccion = {
  pedidos: <ReceiptLongIcon />,
  'scanner-qr': <QrCodeScannerIcon />,
  dashboard: <DashboardIcon />,
};

function Sidebar({ menuItems = [], currentPage, onNavigate }) {
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
          {menuItems.map((item) => {
            const selected = currentPage === item.id;

            return (
              <ListItemButton
                key={item.id}
                selected={selected}
                onClick={() => onNavigate(item.id)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  minHeight: 56,
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
                <ListItemIcon sx={{ color: selected ? '#ffffff' : '#94a3b8' }}>
                  {item.id === 'pedidos' ? (
                    <Badge badgeContent={pendientesCount} color="error">
                      {iconosPorSeccion[item.id]}
                    </Badge>
                  ) : (
                    iconosPorSeccion[item.id]
                  )}
                </ListItemIcon>

                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;