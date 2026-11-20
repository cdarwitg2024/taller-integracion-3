import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';

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

// Estado aislado de una cafetería: nunca reutiliza pedidos, errores ni selección de la anterior.
function estadoInicialKds(cafeteriaKey) {
  return {
    cafeteriaKey,
    pedidos: [],
    selectedPedido: null,
    loading: true,
    conexion: ESTADO_RECONECTANDO,
    errorComandas: '',
    errorOperacion: '',
    procesando: new Set(),
  };
}

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

function cafeteriaIdValido(valor) {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cafeteriaDelUsuario(usuario) {
  const candidatos = [
    usuario?.cafeteria_id,
    usuario?.cafeteriaId,
    usuario?.usuario?.cafeteria_id,
    usuario?.perfil?.cafeteria_id,
  ];
  return candidatos.map(cafeteriaIdValido).find(id => id !== null) ?? null;
}

function conservarDetallesPedido(anterior, actualizado) {
  if (!actualizado) return anterior;
  const fusionado = { ...anterior, ...actualizado };
  if ((!Array.isArray(actualizado.productos) || actualizado.productos.length === 0)
    && Array.isArray(anterior?.productos) && anterior.productos.length > 0) {
    fusionado.productos = anterior.productos;
  }
  if ((!Array.isArray(actualizado.detalles_pedido) || actualizado.detalles_pedido.length === 0)
    && Array.isArray(anterior?.detalles_pedido) && anterior.detalles_pedido.length > 0) {
    fusionado.detalles_pedido = anterior.detalles_pedido;
  }
  return fusionado;
}

function Comandas({ currentUser }) {
  const cafeteriaIdEmpleado = cafeteriaDelUsuario(currentUser);
  const sinCafeteriaAsociada = cafeteriaIdEmpleado === null;
  const cafeteriaKey = sinCafeteriaAsociada ? 'sin-cafeteria' : String(cafeteriaIdEmpleado);

  const [estado, setEstado] = useState(() => estadoInicialKds(cafeteriaKey));
  const [escaneando, setEscaneando] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState(vozKds.obtenerEstado());
  const [diagnosticoVoz, setDiagnosticoVoz] = useState(vozKds.obtenerDiagnostico());
  const [avisoVoz, setAvisoVoz] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const pedidosRealtime = useRef(new Map());
  const anunciadosRef = useRef(new Set());
  const contextoRef = useRef(cafeteriaKey);
  const generacionRef = useRef(0);
  const montadoRef = useRef(true);

  // Invalidar antes de los efectos evita que una promesa de la cafetería anterior
  // publique estado en el primer render de la nueva.
  if (contextoRef.current !== cafeteriaKey) {
    contextoRef.current = cafeteriaKey;
    generacionRef.current += 1;
    pedidosRealtime.current.clear();
    anunciadosRef.current.clear();
  }
  const generacion = generacionRef.current;

  const datos = estado.cafeteriaKey === cafeteriaKey ? estado : estadoInicialKds(cafeteriaKey);
  const {
    pedidos, selectedPedido, loading, conexion, errorComandas, errorOperacion, procesando,
  } = datos;
  const pedidosRef = useRef(pedidos);
  pedidosRef.current = pedidos;
  const escaneandoVisible = estado.cafeteriaKey === cafeteriaKey && escaneando;
  const busquedaVisible = estado.cafeteriaKey === cafeteriaKey ? busqueda : '';

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  // T16 · Avisos de voz: la UI refleja el estado del servicio de voz.
  useEffect(() => vozKds.suscribir((estadoVozServicio, diagnostico) => {
    setEstadoVoz(estadoVozServicio);
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

  useEffect(() => {
    setEstado(prev => (prev.cafeteriaKey === cafeteriaKey ? prev : estadoInicialKds(cafeteriaKey)));
    setEscaneando(false);
    setBusqueda('');
  }, [cafeteriaKey]);

  // Solo publican estado la generación vigente: ni respuestas atrasadas ni desmontaje.
  const vigente = useCallback((gen = generacion) => (
    montadoRef.current && gen === generacionRef.current && contextoRef.current === cafeteriaKey
  ), [cafeteriaKey, generacion]);

  const actualizar = useCallback((cambios, gen = generacion) => {
    if (!vigente(gen)) return;
    setEstado(prev => (prev.cafeteriaKey === cafeteriaKey
      ? { ...prev, ...(typeof cambios === 'function' ? cambios(prev) : cambios) }
      : prev));
  }, [vigente, cafeteriaKey, generacion]);

  // Un pedido sin cafetería explícita no se acepta como nuevo: solo se admite
  // como actualización de una comanda ya visible en este contexto.
  const perteneceACafeteria = useCallback((comanda) => (
    Number.isFinite(cafeteriaIdEmpleado)
      && comanda?.cafeteria_id != null
      && Number(comanda.cafeteria_id) === cafeteriaIdEmpleado
  ), [cafeteriaIdEmpleado]);

  const mergeConSnapshot = useCallback((snapshot, gen = generacion) => {
    actualizar(prev => {
      const idsSnap = new Set(snapshot.map(p => String(p.id)));
      const extra = [];
      pedidosRealtime.current.forEach((comanda, id) => {
        if (!idsSnap.has(id) && !prev.pedidos.some(p => String(p.id) === id)) extra.push(comanda);
      });
      // `getAll` viene ordenado de más nuevo a más viejo: sin volver a
      // ordenar, el poll de respaldo.botaba el orden por hora en cada pasada.
      return { pedidos: ordenarPedidos([...extra, ...snapshot]) };
    }, gen);
  }, [actualizar, generacion]);

  const fetchPedidos = useCallback(async (isRetry = false, gen = generacion) => {
    if (!vigente(gen)) return;
    if (sinCafeteriaAsociada) {
      actualizar({
        pedidos: [],
        errorComandas: 'Este empleado no tiene una cafetería asociada. No es posible consultar comandas.',
        loading: false,
      }, gen);
      return;
    }
    actualizar(prev => ({ loading: true, errorComandas: isRetry ? prev.errorComandas : '' }), gen);
    try {
      const data = await pedidosService.getAll({ cafeteriaId: cafeteriaIdEmpleado });
      if (!vigente(gen)) return;
      actualizar({ errorComandas: '', loading: false }, gen);
      mergeConSnapshot(data, gen);
    } catch (err) {
      if (!vigente(gen)) return;
      console.error('Error cargando comandas:', err);
      actualizar({ errorComandas: err?.message || 'Error al cargar comandas', loading: false }, gen);
    }
  }, [vigente, actualizar, mergeConSnapshot, sinCafeteriaAsociada, cafeteriaIdEmpleado, generacion]);

  const agregarComandaRealTime = useCallback((comanda, gen = generacion) => {
    if (!vigente(gen) || sinCafeteriaAsociada || !comanda?.id || !perteneceACafeteria(comanda)) return;
    const id = String(comanda.id);
    const yaConocida = pedidosRealtime.current.has(id) || pedidosRef.current.some(p => String(p.id) === id);
    pedidosRealtime.current.set(id, comanda);
    if (!yaConocida) actualizar(prev => ({ pedidos: ordenarPedidos([comanda, ...prev.pedidos]) }), gen);
    // T16 · un UPDATE adelantado no debe quitar el aviso del pedido nuevo.
    if (!anunciadosRef.current.has(id)) {
      anunciadosRef.current.add(id);
      vozKds.anunciar(comanda);
    }
  }, [vigente, perteneceACafeteria, actualizar, sinCafeteriaAsociada, generacion]);

  const actualizarPedidoRealTime = useCallback((comanda, gen = generacion) => {
    if (!vigente(gen) || sinCafeteriaAsociada || !comanda?.id) return;
    const id = String(comanda.id);
    const conocida = pedidosRealtime.current.has(id) || pedidosRef.current.some(p => String(p.id) === id);
    // Con cafetería declarada se exige la propia, aunque el ID ya sea conocido.
    if (comanda.cafeteria_id != null ? !perteneceACafeteria(comanda) : !conocida) return;
    pedidosRealtime.current.set(id, comanda);
    actualizar(prev => ({
      pedidos: prev.pedidos.some(p => String(p.id) === id)
        ? ordenarPedidos(prev.pedidos.map(p => (
          String(p.id) === id ? conservarDetallesPedido(p, comanda) : p
        )))
        : ordenarPedidos([comanda, ...prev.pedidos]),
      selectedPedido: prev.selectedPedido && String(prev.selectedPedido.id) === id
        ? conservarDetallesPedido(prev.selectedPedido, comanda)
        : prev.selectedPedido,
    }), gen);
  }, [vigente, perteneceACafeteria, actualizar, sinCafeteriaAsociada, generacion]);

  useEffect(() => {
    fetchPedidos(false);
  }, [fetchPedidos]);

  useEffect(() => {
    if (sinCafeteriaAsociada) {
      actualizar({ conexion: ESTADO_RECONECTANDO }, generacion);
      return undefined;
    }
    const gen = generacion;
    const suscripcion = kdsRealtime.suscribir({
      onComanda: comanda => agregarComandaRealTime(comanda, gen),
      onActualizar: comanda => actualizarPedidoRealTime(comanda, gen),
      onEstadoCanal: estadoCanal => actualizar({ conexion: estadoCanal }, gen),
      cafeteriaId: cafeteriaIdEmpleado,
    });
    return () => suscripcion.cerrar();
  }, [agregarComandaRealTime, actualizarPedidoRealTime, actualizar, cafeteriaIdEmpleado, sinCafeteriaAsociada, generacion]);

  useEffect(() => {
    if (sinCafeteriaAsociada) return;
    const gen = generacion;
    const poll = setInterval(() => {
      pedidosService.getAll({ cafeteriaId: cafeteriaIdEmpleado })
        .then((data) => {
          if (!vigente(gen)) return;
          actualizar({ errorComandas: '' }, gen);
          mergeConSnapshot(data, gen);
        })
        .catch((err) => {
          if (!vigente(gen)) return;
          console.error('Error en polling de comandas:', err);
          // No eliminar comandas ya visibles ante fallo temporal
        });
    }, 10000);
    return () => clearInterval(poll);
  }, [actualizar, mergeConSnapshot, vigente, cafeteriaIdEmpleado, sinCafeteriaAsociada, generacion]);

  useEffect(() => {
    if (estado.cafeteriaKey !== cafeteriaKey) return;
    const idsVisibles = new Set(pedidos.map(p => String(p.id)));
    pedidosRealtime.current.forEach((_comanda, id) => {
      if (!idsVisibles.has(id)) pedidosRealtime.current.delete(id);
    });
  }, [pedidos, estado.cafeteriaKey, cafeteriaKey]);

  const handleCambiarEstado = async (id, nuevoEstado, e) => {
    if (e) e.stopPropagation();
    const gen = generacion;
    if (!vigente(gen)) return;
    const key = String(id);
    if (procesando.has(key) || !pedidosRef.current.some(p => String(p.id) === key)) return;
    actualizar(prev => ({ procesando: new Set(prev.procesando).add(key) }), gen);
    try {
      const actualizado = await pedidosService.updateEstado(id, nuevoEstado);
      if (!vigente(gen)) return;
      if (actualizado) {
        actualizarPedidoRealTime(actualizado, gen);
      } else {
        actualizar(prev => ({
          pedidos: prev.pedidos.map(p => (String(p.id) === key ? { ...p, estado: nuevoEstado } : p)),
          selectedPedido: prev.selectedPedido && String(prev.selectedPedido.id) === key
            ? { ...prev.selectedPedido, estado: nuevoEstado }
            : prev.selectedPedido,
        }), gen);
      }
    } catch (err) {
      if (!vigente(gen)) return;
      console.error('Error al cambiar estado:', err);
      const msg = err?.message || 'No se pudo cambiar el estado del pedido';
      let mensaje;
      if (String(msg).toLowerCase().includes('no autorizado') || err?.status === 401 || err?.code === 'UNAUTHORIZED') {
        mensaje = 'Sesión inválida o vencida. No se pudo cambiar el estado. Inicie sesión nuevamente.';
      } else if (err?.status === 403) {
        mensaje = 'No tiene permisos para cambiar el estado de este pedido.';
      } else if (err?.status === 409) {
        mensaje = 'No se pudo cambiar el estado: hay un conflicto con el estado actual del pedido.';
      } else if (String(msg).toLowerCase().includes('failed to fetch') || String(msg).toLowerCase().includes('network')) {
        mensaje = 'Sin conexión al backend. Verifique su red e inténtelo nuevamente.';
      } else {
        mensaje = `Error al cambiar estado: ${msg}`;
      }
      actualizar({ errorOperacion: mensaje }, gen);
    } finally {
      if (vigente(gen)) {
        actualizar(prev => {
          const next = new Set(prev.procesando);
          next.delete(key);
          return { procesando: next };
        }, gen);
      }
    }
  };

  const pedidosOrdenados = useMemo(() => ordenarPedidos(pedidos), [pedidos]);
  const pedidosFiltrados = useMemo(() => {
    const q = busquedaVisible.trim().toLowerCase();
    if (!q) return pedidosOrdenados;
    return pedidosOrdenados.filter(p => {
      const codigo = String(p.codigo_pedido || '').toLowerCase();
      const id = String(p.id || p.rawId || '').toLowerCase();
      return codigo.includes(q) || id.includes(q);
    });
  }, [pedidosOrdenados, busquedaVisible]);
  const pedidosOperativos = pedidosFiltrados.filter(p =>
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
          busqueda={busquedaVisible}
          onBusquedaChange={setBusqueda}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={56} />
        </Box>
      ) : (
        <>
          {conexion !== ESTADO_CONECTADO && pedidosOperativos.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="warning">Conexión en tiempo real interrumpida. Las comandas se mantienen, se intentará reconectar.</Alert>
            </Box>
          )}
          {errorOperacion && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="error" onClose={() => actualizar({ errorOperacion: '' }, generacion)} action={<Button color="inherit" size="small">Entendido</Button>}>{errorOperacion}</Alert>
            </Box>
          )}
          {errorComandas && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => fetchPedidos(true, generacion)}>Reintentar</Button>}>
                {errorComandas}
              </Alert>
            </Box>
          )}
          {errorComandas && pedidosOperativos.length === 0 ? (
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography color="text.secondary">No hay comandas para mostrar</Typography>
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
                      onOpen={pedido => actualizar({ selectedPedido: pedido }, generacion)}
                      onChangeEstado={handleCambiarEstado}
                      procesando={procesando.has(String(pedido.id))}
                    />
                  ))
                )}
              </KanbanColumn>
            );
          })}
        </Box>
          )}
        </>
      )}

      <DetallePedidoDialog
        key={cafeteriaKey}
        pedido={selectedPedido}
        onClose={() => actualizar({ selectedPedido: null }, generacion)}
        onChangeEstado={handleCambiarEstado}
      />

      <EscanearQrDialog
        open={escaneandoVisible}
        cafeteriaId={cafeteriaIdEmpleado}
        usuarioId={currentUser?.id != null ? String(currentUser.id) : 'empleado'}
        onClose={() => setEscaneando(false)}
      />
    </Box>
  );
}

export default Comandas;
