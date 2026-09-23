import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import KdsTopBar from '../../components/KdsTopBar';
import KanbanColumn from '../../components/KanbanColumn';
import PedidoCard from '../../components/PedidoCard';
import DetallePedidoDialog from '../../components/DetallePedidoDialog';

import pedidosService, { ordenarPedidos } from '../../services/pedidosService';
import kdsRealtime, {
  ESTADO_CONECTADO,
  ESTADO_RECONECTANDO,
} from '../../services/kdsRealtime';

const COLUMNAS = [
  { estado: 'pendiente', titulo: 'Pendiente', backgroundColor: '#F2ECE7' },
  { estado: 'preparando', titulo: 'En Preparación', backgroundColor: '#FFF3E0' },
  { estado: 'listo', titulo: 'Listos para Retiro', backgroundColor: '#E8F5E9' },
];

function Comandas() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conexion, setConexion] = useState(ESTADO_RECONECTANDO);

  const pedidosRealtime = useRef(new Map());

  const mergeConSnapshot = useCallback((snapshot) => {
    setPedidos(prev => {
      const idsSnap = new Set(snapshot.map(p => String(p.id)));
      const extra = [];
      pedidosRealtime.current.forEach((comanda, id) => {
        if (!idsSnap.has(id) && !prev.some(p => String(p.id) === id)) extra.push(comanda);
      });
      return [...extra, ...snapshot];
    });
  }, []);

  const fetchPedidos = useCallback(async () => {
    const data = await pedidosService.getAll();
    mergeConSnapshot(data);
    setLoading(false);
  }, [mergeConSnapshot]);

  const agregarComandaRealTime = useCallback((comanda) => {
    const id = String(comanda.id);
    pedidosRealtime.current.set(id, comanda);
    setPedidos(prev => (prev.some(p => String(p.id) === id) ? prev : ordenarPedidos([comanda, ...prev])));
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const suscripcion = kdsRealtime.suscribir({
      onComanda: agregarComandaRealTime,
      onEstadoCanal: setConexion,
    });
    return () => suscripcion.cerrar();
  }, [agregarComandaRealTime]);

  useEffect(() => {
    const poll = setInterval(() => {
      pedidosService.getAll().then(mergeConSnapshot);
    }, 10000);
    return () => clearInterval(poll);
  }, [mergeConSnapshot]);

  const handleCambiarEstado = async (id, nuevoEstado, e) => {
    if (e) e.stopPropagation();
    await pedidosService.updateEstado(id, nuevoEstado);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    if (selectedPedido && selectedPedido.id === id) {
      setSelectedPedido(prev => ({ ...prev, estado: nuevoEstado }));
    }
  };

  const pedidosOrdenados = useMemo(() => ordenarPedidos(pedidos), [pedidos]);
  const pedidosOperativos = pedidosOrdenados.filter(p =>
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
        <KdsTopBar conexion={conexion} />
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
            const items = pedidosOperativos.filter(p => p.estado === col.estado);

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

export default Comandas;
