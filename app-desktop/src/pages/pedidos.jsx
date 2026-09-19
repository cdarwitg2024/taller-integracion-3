import { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import KdsTopBar from '../components/KdsTopBar';
import KanbanColumn from '../components/KanbanColumn';
import PedidoCard from '../components/PedidoCard';
import DetallePedidoDialog from '../components/DetallePedidoDialog';

import pedidosService from '../services/pedidosService';

const COLUMNAS = [
  { estado: 'pendiente', titulo: 'Pendiente', backgroundColor: '#F2ECE7' },
  { estado: 'preparando', titulo: 'En Preparación', backgroundColor: '#FFF3E0' },
  { estado: 'listo', titulo: 'Listos para Retiro', backgroundColor: '#E8F5E9' },
];

function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async () => {
    const data = await pedidosService.getAll();
    setPedidos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const poll = setInterval(() => {
      pedidosService.getAll().then(setPedidos);
    }, 10000);
    return () => clearInterval(poll);
  }, []);

  const handleCambiarEstado = async (id, nuevoEstado, e) => {
    if (e) e.stopPropagation();
    await pedidosService.updateEstado(id, nuevoEstado);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    if (selectedPedido && selectedPedido.id === id) {
      setSelectedPedido(prev => ({ ...prev, estado: nuevoEstado }));
    }
  };

  const pedidosOperativos = pedidos.filter(p =>
    p.estado === 'pendiente' || p.estado === 'preparando' || p.estado === 'listo'
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 128px)',
        minHeight: 560,
        pb: 2,
      }}
    >
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <KdsTopBar />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={56} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 3,
            flexGrow: 1,
            minHeight: 0,
          }}
        >
          {COLUMNAS.map(col => {
            const items = pedidosOperativos
              .filter(p => p.estado === col.estado)
              .sort((a, b) => new Date(a.creado_en || 0) - new Date(b.creado_en || 0));

            return (
              <KanbanColumn
                key={col.estado}
                titulo={col.titulo}
                count={items.length}
                backgroundColor={col.backgroundColor}
              >
                {items.length === 0 ? (
                  <Box
                    sx={{
                      borderRadius: 3,
                      border: '2px dashed #C8B2A1',
                      p: 3,
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ color: '#78665B', fontWeight: 700 }}>
                      Sin comandas
                    </Typography>
                  </Box>
                ) : (
                  items.map(pedido => (
                    <PedidoCard
                      key={pedido.id}
                      pedido={pedido}
                      onOpen={setSelectedPedido}
                      onChangeEstado={handleCambiarEstado}
                    />
                  ))
                )}
              </KanbanColumn>
            );
          })}
        </Box>
      )}

      <DetallePedidoDialog
        pedido={selectedPedido}
        onClose={() => setSelectedPedido(null)}
        onChangeEstado={handleCambiarEstado}
      />
    </Box>
  );
}

export default Pedidos;