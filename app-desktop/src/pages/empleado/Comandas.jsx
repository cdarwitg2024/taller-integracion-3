import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';

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
import vozKds, { VOZ_APAGADA, VOZ_SILENCIADA } from '../../services/vozKdsService';
import { kdsColors } from '../../theme/theme';
import { COLORS } from '../../design/tokens';

// Estado vacío de una columna. Se define una sola vez para las tres columnas.
function EstadoVacioColumna() {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `2px dashed ${kdsColors.onDarkSoft}`,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ color: kdsColors.textSecondary, fontWeight: 700 }}>
        Sin comandas
      </Typography>
    </Box>
  );
}

// Tinte de cada columna alineado a los tokens de estado (los mismos que usa
// BaseBadge para el chip de la tarjeta), para que el color de la columna y el
// de la tarjeta cuenten lo mismo.
const COLUMNAS = [
  { estado: 'pendiente', titulo: 'Pendiente', backgroundColor: COLORS.surfaceAlt },
  { estado: 'en_preparacion', titulo: 'En Preparación', backgroundColor: COLORS.warningBg },
  { estado: 'listo', titulo: 'Listos para Retiro', backgroundColor: COLORS.infoBg },
];

function Comandas({ currentUser }) {
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conexion, setConexion] = useState(ESTADO_RECONECTANDO);
  const [estadoVoz, setEstadoVoz] = useState(vozKds.obtenerEstado());
  const [diagnosticoVoz, setDiagnosticoVoz] = useState(vozKds.obtenerDiagnostico());
  const [avisoVoz, setAvisoVoz] = useState(null);
  const [errorComandas, setErrorComandas] = useState('');

  const pedidosRealtime = useRef(new Map());

  const cafeteriaIdEmpleado = Number(
    currentUser?.cafeteria_id ??
    currentUser?.cafeteriaId ??
    currentUser?.usuario?.cafeteria_id ??
    currentUser?.perfil?.cafeteria_id
  );
  const sinCafeteriaAsociada = !Number.isFinite(cafeteriaIdEmpleado);

  // T16 · Avisos de voz: la UI refleja el estado del servicio de voz.
  useEffect(() => vozKds.suscribir((estado, diagnostico) => {
    setEstadoVoz(estado);
    setDiagnosticoVoz(diagnostico);
  }), []);

  // Con la voz apagada o silenciada se explica por qué; con la voz
  // activa se muestra el motivo si ElevenLabs no respondió y hubo que
  // usar la voz del sistema.
  useEffect(() => {
    // El diagnóstico del servicio manda: es más específico (por ejemplo
    // "3 pedidos sin anunciar"). Si no hay ninguno, se explica el estado.
    if (diagnosticoVoz) {
      setAvisoVoz(diagnosticoVoz);
    } else if (estadoVoz === VOZ_APAGADA) {
      setAvisoVoz('Avisos de voz desactivados: los pedidos solo se ven en pantalla.');
    } else if (estadoVoz === VOZ_SILENCIADA) {
      setAvisoVoz('Avisos de voz silenciados.');
    } else {
      setAvisoVoz(null);
    }
  }, [estadoVoz, diagnosticoVoz]);

  const mergeConSnapshot = useCallback((snapshot) => {
    setPedidos(prev => {
      const idsSnap = new Set(snapshot.map(p => String(p.id)));
      const extra = [];
      pedidosRealtime.current.forEach((comanda, id) => {
        if (!idsSnap.has(id) && !prev.some(p => String(p.id) === id)) extra.push(comanda);
      });
      // `getAll` viene ordenado de más nuevo a más viejo: sin volver a
      // ordenar, el poll de respaldo.botaba el orden por hora en cada pasada.
      return ordenarPedidos([...extra, ...snapshot]);
    });
  }, []);

  const fetchPedidos = useCallback(async () => {
    if (sinCafeteriaAsociada) {
      setPedidos([]);
      setErrorComandas('Este empleado no tiene una cafetería asociada. No es posible consultar comandas.');
      setLoading(false);
      return;
    }
    try {
      setErrorComandas('');
      const data = await pedidosService.getAll({ cafeteriaId: cafeteriaIdEmpleado });
      mergeConSnapshot(data);
    } catch (err) {
      console.error('Error cargando comandas:', err);
      setErrorComandas(err.message || 'Error al cargar comandas');
    } finally {
      setLoading(false);
    }
  }, [mergeConSnapshot, cafeteriaIdEmpleado, sinCafeteriaAsociada]);

  const agregarComandaRealTime = useCallback((comanda) => {
    if (sinCafeteriaAsociada) return;
    if (Number.isFinite(cafeteriaIdEmpleado) && comanda?.cafeteria_id != null && Number(comanda.cafeteria_id) !== cafeteriaIdEmpleado) {
      return;
    }
    const id = String(comanda.id);
    pedidosRealtime.current.set(id, comanda);
    setPedidos(prev => (prev.some(p => String(p.id) === id) ? prev : ordenarPedidos([comanda, ...prev])));
    // T16 · aviso de voz: solo en ingresos reales por Realtime (nunca en
    // la carga inicial de la pantalla ni en cambios de estado).
    vozKds.anunciar(comanda);
  }, [sinCafeteriaAsociada, cafeteriaIdEmpleado]);

  const actualizarPedidoRealTime = useCallback((comanda) => {
    if (sinCafeteriaAsociada) return;
    if (Number.isFinite(cafeteriaIdEmpleado) && comanda?.cafeteria_id != null && Number(comanda.cafeteria_id) !== cafeteriaIdEmpleado) {
      return;
    }
    const id = String(comanda.id);
    pedidosRealtime.current.set(id, comanda);
    setPedidos(prev => {
      if (!prev.some(p => String(p.id) === id)) return ordenarPedidos([comanda, ...prev]);
      return ordenarPedidos(prev.map(p => (String(p.id) === id ? comanda : p)));
    });
    setSelectedPedido(prev => (prev && String(prev.id) === id ? { ...prev, ...comanda } : prev));
  }, [sinCafeteriaAsociada, cafeteriaIdEmpleado]);

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
    if (sinCafeteriaAsociada) return;
    const poll = setInterval(() => {
      pedidosService.getAll({ cafeteriaId: cafeteriaIdEmpleado })
        .then(mergeConSnapshot)
        .catch((err) => {
          console.error('Error en polling de comandas:', err);
        });
    }, 10000);
    return () => clearInterval(poll);
  }, [mergeConSnapshot, cafeteriaIdEmpleado, sinCafeteriaAsociada]);

  useEffect(() => {
    const idsVisibles = new Set(pedidos.map(p => String(p.id)));
    pedidosRealtime.current.forEach((_comanda, id) => {
      if (!idsVisibles.has(id)) pedidosRealtime.current.delete(id);
    });
  }, [pedidos]);

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
        // Ocupa el alto disponible que le da AppLayout (que ya mide 100vh).
        // Sin píxeles mágicos: las columnas del Kanban hacen scroll interno.
        height: '100%',
      }}
    >
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <KdsTopBar
          conexion={conexion}
          onEscanear={() => setEscaneando(true)}
          estadoVoz={estadoVoz}
          onActivarVoz={() => vozKds.activar()}
          onSilenciarVoz={() => vozKds.silenciar()}
          avisoVoz={avisoVoz}
        />
      </Box>

      {errorComandas ? (
        <Box sx={{ flexGrow: 1 }}>
          <Alert severity="error">{errorComandas}</Alert>
        </Box>
      ) : loading ? (
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
                  <EstadoVacioColumna />
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
        cafeteriaId={cafeteriaIdEmpleado}
        usuarioId={currentUser?.id != null ? String(currentUser.id) : 'empleado'}
        onClose={() => setEscaneando(false)}
      />
    </Box>
  );
}

export default Comandas;
