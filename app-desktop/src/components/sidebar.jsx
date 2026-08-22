import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
} from '@mui/material';

import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import DashboardIcon from '@mui/icons-material/Dashboard';

const drawerWidth = 240;

function Sidebar({ currentPage, onNavigate }) {
  const menuItems = [
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: <ReceiptLongIcon />,
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
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" fontWeight={700}>
          CoffeeFaster
        </Typography>
      </Toolbar>

      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.id}
              selected={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>

              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;

// Menú lateral principal de CoffeeFaster.
// Permite navegar entre Pedidos, Escáner QR y Dashboard.