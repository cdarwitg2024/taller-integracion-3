import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import KdsTopBar from '../../components/KdsTopBar';
import KanbanColumn from '../../components/KanbanColumn';
import PedidoCard from '../../components/PedidoCard';
import DetallePedidoDialog from '../../components/DetallePedidoDialog';
import EscanearQrDialog from '../../components/EscanearQrDialog';

import pedidosService, { ordenarPedidos } from '../../services/pedidosService';
import kdsRealtime, {
  ESTADO_CONECTADO,
  ESTADO_RECONECTANDO,
} from '../../services/kdsRealtime';
import { CAFETERIA_ID } from '../../services/backendApi';

const COLUMNAS = [
  { estado: 'pendiente', titulo: 'Pendiente', backgroundColor: '#F2ECE7' },
  { estado: 'en_preparacion', titulo: 'En Preparación', backgroundColor: '#FFF3E0' },
  { estado: 'listo', titulo: 'Listos para Retiro', backgroundColor: '#E8F5E9' },
];

function Comandas({ currentUser }) {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
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

  const actualizarPedidoRealTime = useCallback((comanda) => {
    const id = String(comanda.id);
    pedidosRealtime.current.set(id, comanda);
    setPedidos(prev => {
      if (!prev.some(p => String(p.id) === id)) return ordenarPedidos([comanda, ...prev]);
      return ordenarPedidos(prev.map(p => (String(p.id) === id ? comanda : p)));
    });
    setSelectedPedido(prev => (prev && String(prev.id) === id ? { ...prev, ...comanda } : prev));
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const suscripcion = kdsRealtime.suscribir({
      onComanda: agregarComandaRealTime,
      onActualizar: actualizarPedidoRealTime,
      onEstadoCanal: setConexion,
    });
    return () => suscripcion.cerrar();
  }, [agregarComandaRealTime, actualizarPedidoRealTime]);

  useEffect(() => {
    const poll = setInterval(() => {
      pedidosService.getAll().then(mergeConSnapshot);
    }, 10000);
    return () => clearInterval(poll);
  }, [mergeConSnapshot]);

  const handleCambiarEstado = async (id, nuevoEstado, e) => {
    if (e) e.stopPropagation();
    const actualizado = await pedidosService.updateEstado(id, nuevoEstado);
    if (actualizado) {
      actualizarPedidoRealTime(actualizado);
    } else {
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
      if (selectedPedido && selectedPedido.id === id) {
        setSelectedPedido(prev => ({ ...prev, estado: nuevoEstado }));
      }
    }
  };

  const pedidosOrdenados = useMemo(() => ordenarPedidos(pedidos), [pedidos]);
  const pedidosOperativos = pedidosOrdenados.filter(p =>
    p.estado === 'pendiente' || p.estado === 'preparando' || p.estado === 'en_preparacion' || p.estado === 'listo'
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
        <KdsTopBar conexion={conexion} onEscanear={() => setEscaneando(true)} />
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

      <EscanearQrDialog
        open={escaneando}
        cafeteriaId={CAFETERIA_ID}
        usuarioId={currentUser?.id != null ? String(currentUser.id) : 'empleado'}
        onClose={() => setEscaneando(false)}
      />
    </Box>
  );
}

export default Comandas;
