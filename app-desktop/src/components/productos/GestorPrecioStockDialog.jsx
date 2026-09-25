import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Divider,
} from '@mui/material';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import ModificarPrecioDialog from './ModificarPrecioDialog';
import ModificarStockDialog from './ModificarStockDialog';

/**
 * Gestor Integral de Precio y Stock Dueño (FR-46 y FR-47)
 * Permite separar y operar de manera individual:
 * - Operación 1: Modificar Precio (FR-46)
 * - Operación 2: Modificar Stock (FR-47)
 */
function GestorPrecioStockDialog({
  open,
  onClose,
  producto = null,
  productosList = [],
  initialTab = 0, // 0 = precio, 1 = stock
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedProdId, setSelectedProdId] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (producto) {
      setSelectedProdId(producto.id);
    } else if (productosList.length > 0) {
      setSelectedProdId(productosList[0].id);
    }
  }, [producto, productosList, open]);

  const currentProducto = producto || productosList.find((p) => p.id === Number(selectedProdId)) || null;

  if (activeTab === 0) {
    return (
      <ModificarPrecioDialog
        open={open}
        onClose={onClose}
        producto={currentProducto}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <ModificarStockDialog
      open={open}
      onClose={onClose}
      producto={currentProducto}
      onSuccess={onSuccess}
    />
  );
}

export default GestorPrecioStockDialog;
