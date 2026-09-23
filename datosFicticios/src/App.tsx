import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import type {
  Cafeteria,
  Producto,
  Pedido,
  DbStatus,
  Estadisticas,
  ProcesoPedidoActivo,
  ProcesosCafeteriaResponse,
} from './types';

export default function App() {
  // Navegación por pasos (Wizard / Línea de tiempo): 1, 2, 3
  const [pasoActual, setPasoActual] = useState<number>(1);

  // 1. Estado de conexión con Base de Datos
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  // 2. Cafeterías y selección (Paso 1)
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [selectedCafeteriaId, setSelectedCafeteriaId] = useState<number | null>(null);

  // 3. Intervalo de tiempo en segundos (Paso 2)
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(10);

  // 4. Control de Simulación / Inserción (Paso 3)
  const [simulando, setSimulando] = useState<boolean>(false);
  const [progresoIntervalo, setProgresoIntervalo] = useState<number>(100);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(intervaloSegundos);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // 4.1. Seguimiento en vivo del flujo de cafetería (Pendiente -> Preparando -> Listo -> Entregado)
  const [procesosCafeteria, setProcesosCafeteria] = useState<ProcesoPedidoActivo[]>([]);
  const [_procesosCompletados, setProcesosCompletados] = useState<ProcesoPedidoActivo[]>([]);

  // 5. Datos y métricas de la cafetería
  const [productos, setProductos] = useState<Producto[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [pedidosInsertados, setPedidosInsertados] = useState<Pedido[]>([]);
  const [ultimoPedidoInsertado, setUltimoPedidoInsertado] = useState<Pedido | null>(null);
  const [animatingId, setAnimatingId] = useState<string | number | null>(null);

  // 6. Estados para menús desplegables (por defecto ocultos para optimizar espacio)
  const [mostrarMenuVisualizacion, setMostrarMenuVisualizacion] = useState<boolean>(false);
  const [mostrarFlujoPedidos, setMostrarFlujoPedidos] = useState<boolean>(false);

  // 7. Contadores de sesión
  const [sessionCompras, setSessionCompras] = useState<number>(0);
  const [sessionTotal, setSessionTotal] = useState<number>(0);
  const [sessionItems, setSessionItems] = useState<number>(0);

  // 8. Notificaciones Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);

  const toastTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'danger' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Carga inicial: Estado de BD y Lista de Cafeterías
  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setDbStatus(data);
    } catch {
      setDbStatus({
        ok: false,
        host: 'localhost',
        port: 54322,
        database: 'postgres',
        user: 'postgres',
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        error: 'No se pudo conectar a PostgreSQL',
      });
    } finally {
      setDbLoading(false);
    }
  };

  const fetchCafeterias = async () => {
    try {
      const res = await fetch('/api/cafeterias');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCafeterias(data);
        if (!selectedCafeteriaId) {
          setSelectedCafeteriaId(Number(data[0].id));
        }
      }
    } catch (err: any) {
      showToast('Error al obtener cafeterías: ' + err.message, 'danger');
    }
  };

  useEffect(() => {
    fetchDbStatus();
    fetchCafeterias();
  }, []);

  // Cargar datos de la cafetería seleccionada
  const loadCafeteriaData = useCallback(async (cafId: number) => {
    if (!cafId) return;
    try {
      const [prodsRes, statsRes, pedidosRes] = await Promise.all([
        fetch(`/api/cafeterias/${cafId}/productos`).then((r) => r.json()),
        fetch(`/api/cafeterias/${cafId}/estadisticas`).then((r) => r.json()),
        fetch(`/api/cafeterias/${cafId}/pedidos?limit=10`).then((r) => r.json()),
      ]);

      if (Array.isArray(prodsRes)) setProductos(prodsRes);
      if (statsRes && !statsRes.error) setEstadisticas(statsRes);
      if (Array.isArray(pedidosRes)) {
        setPedidosInsertados(pedidosRes);
        if (pedidosRes.length > 0) {
          setUltimoPedidoInsertado(pedidosRes[0]);
        }
      }
    } catch (err: any) {
      console.error('Error cargando datos:', err);
    }
  }, []);

  // Cargar estado en vivo de pedidos en proceso de cafetería
  const fetchProcesoCafeteria = useCallback(async (cafId: number) => {
    if (!cafId) return;
    try {
      const res = await fetch(`/api/cafeterias/${cafId}/proceso-cafeteria`);
      if (res.ok) {
        const data: ProcesosCafeteriaResponse = await res.json();
        setProcesosCafeteria(data.activos || []);
        setProcesosCompletados(data.completados || []);
      }
    } catch {
      // Ignorar errores de red temporales en polling continuo
    }
  }, []);

  useEffect(() => {
    if (selectedCafeteriaId) {
      loadCafeteriaData(selectedCafeteriaId);
      fetchProcesoCafeteria(selectedCafeteriaId);
    }
  }, [selectedCafeteriaId, loadCafeteriaData, fetchProcesoCafeteria]);

  // Polling continuo en Paso 3 para vigilar cambios de estado de cafetería en tiempo real (cada 1.5s)
  useEffect(() => {
    if (pasoActual !== 3 || !selectedCafeteriaId) return;

    fetchProcesoCafeteria(selectedCafeteriaId);
    loadCafeteriaData(selectedCafeteriaId);

    const timer = setInterval(() => {
      fetchProcesoCafeteria(selectedCafeteriaId);
      loadCafeteriaData(selectedCafeteriaId);
    }, 1500);

    return () => clearInterval(timer);
  }, [pasoActual, selectedCafeteriaId, fetchProcesoCafeteria, loadCafeteriaData]);

  // Avanzar manualmente de etapa (para pruebas inmediatas)
  const handleAvanzarPaso = async (pedidoId: number) => {
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/avanzar-proceso`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast(`⚡ Pedido #${pedidoId} avanzado al siguiente estado`, 'success');
        if (selectedCafeteriaId) {
          fetchProcesoCafeteria(selectedCafeteriaId);
          loadCafeteriaData(selectedCafeteriaId);
        }
      }
    } catch (err: any) {
      showToast('Error al avanzar estado: ' + err.message, 'danger');
    }
  };

  const getStageIndex = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return 0;
      case 'preparando':
        return 1;
      case 'listo':
        return 2;
      case 'entregado':
        return 3;
      default:
        return 0;
    }
  };

  const renderEstadoBadge = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return <span className="status-badge-stage stage-pendiente">⏳ PENDIENTE</span>;
      case 'preparando':
        return <span className="status-badge-stage stage-preparando">🍳 EN PREPARACIÓN</span>;
      case 'listo':
        return <span className="status-badge-stage stage-listo">🔔 LISTO</span>;
      case 'entregado':
        return <span className="status-badge-stage stage-entregado">✅ ENTREGADO</span>;
      default:
        return <span className="status-badge-stage">{estado?.toUpperCase() || 'PROCESANDO'}</span>;
    }
  };

  const renderMiniPipeline = (estado: string) => {
    const currentIdx = getStageIndex(estado);
    const stages = [
      { key: 'pendiente', label: 'Pendiente', icon: '⏳' },
      { key: 'preparando', label: 'En prep.', icon: '🍳' },
      { key: 'listo', label: 'Listo', icon: '🔔' },
      { key: 'entregado', label: 'Entregado', icon: '✅' },
    ];

    return (
      <div className="mini-pipeline-row">
        {stages.map((st, idx) => {
          const isActive = idx === currentIdx;
          const isPassed = idx < currentIdx;
          return (
            <span key={st.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span
                className={`mini-pipeline-dot-stage ${isActive ? `is-active p-${st.key}` : ''}`}
                title={st.label}
              >
                {isPassed ? '✓' : st.icon} {st.label}
              </span>
              {idx < 3 && <span className="mini-pipeline-arrow">➔</span>}
            </span>
          );
        })}
      </div>
    );
  };

  // Insertar compra simulada con flujo completo de cafetería (1 a 10s por etapa)
  const handleInsertarCompra = async (silencioso = false) => {
    if (!selectedCafeteriaId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/simular-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeteria_id: selectedCafeteriaId,
          proceso_cafeteria: true,
          delay_min: 1,
          delay_max: 10,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.inventarioAgotado) {
          showToast('⚠️ ¡Sin inventario! Haz clic en "Reponer Todo el Inventario".', 'warning');
          setSimulando(false);
          return;
        }
        throw new Error(data.error || 'Error al insertar compra');
      }

      const nuevoTotal = Number(data.pedido.total) || 0;
      const cantItems = data.pedido.items
        ? data.pedido.items.reduce((sum: number, it: any) => sum + it.cantidad, 0)
        : 1;

      // Actualizar contadores
      setSessionCompras((prev) => prev + 1);
      setSessionTotal((prev) => prev + nuevoTotal);
      setSessionItems((prev) => prev + cantItems);

      // Efecto visual de nueva inserción
      setUltimoPedidoInsertado(data.pedido);
      setAnimatingId(data.pedido.id);
      setTimeout(() => setAnimatingId(null), 1200);

      // Agregar al feed de inserciones
      setPedidosInsertados((prev) => [data.pedido, ...prev.slice(0, 9)]);

      // Actualizar datos de stock y cafetería en segundo plano
      await Promise.all([
        loadCafeteriaData(selectedCafeteriaId),
        fetchProcesoCafeteria(selectedCafeteriaId),
      ]);

      if (!silencioso) {
        const itemNames = data.pedido.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', ');
        showToast(`⏳ Pedido #${data.pedido.id} iniciado en PENDIENTE: ${itemNames} (Avanzará por cocina en 1 a 10s)`, 'success');
      }

      if (data.alertasStock && data.alertasStock.length > 0) {
        const al = data.alertasStock[0];
        showToast(`⚠️ Alerta: Stock bajo en "${al.nombre}" (${al.stock_actual} restantes)`, 'warning');
      }
    } catch (err: any) {
      showToast('Error al insertar compra: ' + err.message, 'danger');
      setSimulando(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Inserción en ráfaga (5 compras escalonadas en el flujo de cocina)
  const handleInsertarLote = async (cantidad = 5) => {
    if (!selectedCafeteriaId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/simular-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeteria_id: selectedCafeteriaId,
          cantidad,
          proceso_cafeteria: true,
          delay_min: 1,
          delay_max: 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al insertar lote');

      const creados: Pedido[] = data.pedidos || [];
      const totalLote = creados.reduce((acc: number, p: any) => acc + (Number(p.total) || 0), 0);

      setSessionCompras((prev) => prev + creados.length);
      setSessionTotal((prev) => prev + totalLote);

      if (creados.length > 0) {
        setUltimoPedidoInsertado(creados[creados.length - 1]);
        setPedidosInsertados((prev) => [...creados, ...prev].slice(0, 10));
      }

      await Promise.all([
        loadCafeteriaData(selectedCafeteriaId),
        fetchProcesoCafeteria(selectedCafeteriaId),
      ]);

      showToast(`⚡ ${creados.length} pedidos iniciados en PENDIENTE (se prepararán escalonadamente entre 1 y 10s por fase)`, 'success');
    } catch (err: any) {
      showToast('Error en inserción por lote: ' + err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // Reponer Todo el Inventario
  const handleReponerInventario = async () => {
    if (!selectedCafeteriaId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/reponer-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeteria_id: selectedCafeteriaId,
          unidades: 35,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reponer');

      await loadCafeteriaData(selectedCafeteriaId);
      showToast(`🎉 ¡Inventario repuesto! Se reabastecieron ${data.reabastecidos} productos con stock óptimo.`, 'success');
    } catch (err: any) {
      showToast('Error al reponer inventario: ' + err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // Temporizador de simulación automática
  useEffect(() => {
    if (!simulando || !selectedCafeteriaId || pasoActual !== 3) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setProgresoIntervalo(100);
      setSegundosRestantes(intervaloSegundos);
      return;
    }

    const intervalMs = Math.max(1, intervaloSegundos) * 1000;
    const stepMs = 100;
    let elapsedMs = 0;

    countdownIntervalRef.current = setInterval(() => {
      elapsedMs += stepMs;
      const remainingSec = Math.max(0, (intervalMs - elapsedMs) / 1000);
      setSegundosRestantes(Number(remainingSec.toFixed(1)));
      const pct = Math.max(0, 100 - (elapsedMs / intervalMs) * 100);
      setProgresoIntervalo(pct);

      if (elapsedMs >= intervalMs) {
        elapsedMs = 0;
        handleInsertarCompra(true);
      }
    }, stepMs);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [simulando, intervaloSegundos, selectedCafeteriaId, pasoActual]);

  // Datos calculados
  const currentCafeteria = cafeterias.find((c) => Number(c.id) === selectedCafeteriaId);
  const totalStockUnidades = productos.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const sinStockCount = productos.filter((p) => Number(p.stock) <= 0).length;

  return (
    <div className="wizard-layout">
      {/* Barra superior con estado de BD */}
      <header className="wizard-header">
        <div className="brand-group">
          <span className="brand-icon">☕</span>
          <div>
            <h1 className="main-title">CoffeeFaster - Generador de Datos Ficticios</h1>
            <p className="main-desc">Simulador conectado a base de datos PostgreSQL</p>
          </div>
        </div>

        <div className="db-badge">
          {dbLoading ? (
            <span>Conectando...</span>
          ) : dbStatus?.ok ? (
            <span className="db-connected">
              ● Conectado a PostgreSQL ({dbStatus.database} @ {dbStatus.host}:{dbStatus.port})
            </span>
          ) : (
            <span className="db-error">● Sin conexión a Base de Datos</span>
          )}
        </div>
      </header>

      {/* Línea de Tiempo / Stepper de Pasos */}
      <div className="timeline-container">
        <div className="timeline-stepper">
          {/* Paso 1: Cafetería */}
          <button
            type="button"
            className={`timeline-step ${pasoActual === 1 ? 'active' : ''} ${pasoActual > 1 ? 'completed' : ''}`}
            onClick={() => {
              setSimulando(false);
              setPasoActual(1);
            }}
          >
            <span className="step-circle">{pasoActual > 1 ? '✓' : '1'}</span>
            <div className="step-text">
              <span className="step-tag">Paso 1</span>
              <span className="step-name">Seleccionar Cafetería</span>
            </div>
          </button>

          <div className={`timeline-line ${pasoActual > 1 ? 'completed-line' : ''}`} />

          {/* Paso 2: Intervalo */}
          <button
            type="button"
            className={`timeline-step ${pasoActual === 2 ? 'active' : ''} ${pasoActual > 2 ? 'completed' : ''}`}
            onClick={() => {
              if (selectedCafeteriaId) {
                setSimulando(false);
                setPasoActual(2);
              }
            }}
            disabled={!selectedCafeteriaId}
          >
            <span className="step-circle">{pasoActual > 2 ? '✓' : '2'}</span>
            <div className="step-text">
              <span className="step-tag">Paso 2</span>
              <span className="step-name">Tiempo de Intervalo</span>
            </div>
          </button>

          <div className={`timeline-line ${pasoActual > 2 ? 'completed-line' : ''}`} />

          {/* Paso 3: Inserción & Visualizador */}
          <button
            type="button"
            className={`timeline-step ${pasoActual === 3 ? 'active' : ''}`}
            onClick={() => {
              if (selectedCafeteriaId) setPasoActual(3);
            }}
            disabled={!selectedCafeteriaId}
          >
            <span className="step-circle">3</span>
            <div className="step-text">
              <span className="step-tag">Paso 3</span>
              <span className="step-name">Insertar & Visualizar</span>
            </div>
          </button>
        </div>
      </div>

      {/* Contenido Principal según el Paso Activo */}
      <main className="wizard-content">
        {/* ======================================================== */}
        {/* PANTALLA 1: SELECCIONAR CAFETERÍA DISPONIBLE */}
        {/* ======================================================== */}
        {pasoActual === 1 && (
          <section className="wizard-card animated-step">
            <div className="card-header-clean">
              <div className="step-badge">Paso 1 de 3</div>
              <h2 className="card-main-heading">Selecciona una Cafetería Disponible</h2>
              <p className="card-sub-heading">
                Elige la cafetería sobre la cual se insertarán las compras y datos ficticios
              </p>
            </div>

            <div className="cafeterias-grid">
              {cafeterias.map((caf) => {
                const isSelected = selectedCafeteriaId === Number(caf.id);
                return (
                  <div
                    key={caf.id}
                    className={`cafeteria-choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCafeteriaId(Number(caf.id))}
                  >
                    <div className="choice-radio">
                      <span className={`radio-dot ${isSelected ? 'checked' : ''}`} />
                    </div>

                    <div className="choice-info">
                      <h3 className="choice-name">{caf.nombre}</h3>
                      <p className="choice-location">📍 {caf.nombre_sede || 'Campus Central'}</p>
                      {caf.descripcion && <p className="choice-desc">{caf.descripcion}</p>}

                      {isSelected && (
                        <div className="choice-extra">
                          <span className="tag-ok">
                            📦 {productos.length} productos registrados ({totalStockUnidades} u. en stock)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de navegación inferior */}
            <div className="wizard-actions-bar">
              <div />
              <button
                type="button"
                className="btn-next"
                disabled={!selectedCafeteriaId}
                onClick={() => setPasoActual(2)}
              >
                <span>Siguiente: Tiempo de Intervalo</span>
                <span className="arrow-icon">➔</span>
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* PANTALLA 2: TIEMPO DE INTERVALO */}
        {/* ======================================================== */}
        {pasoActual === 2 && (
          <section className="wizard-card animated-step">
            <div className="card-header-clean">
              <div className="step-badge">Paso 2 de 3</div>
              <h2 className="card-main-heading">Configurar Tiempo de Intervalo</h2>
              <p className="card-sub-heading">
                Define cada cuántos segundos se insertará automáticamente una compra en la base de datos
              </p>
            </div>

            <div className="interval-wizard-box">
              <div className="interval-hero-number">
                <span className="hero-digits">{intervaloSegundos}</span>
                <span className="hero-unit">segundos</span>
              </div>
              <p className="hero-sub">Se insertará 1 compra simulada cada {intervaloSegundos} segundo(s)</p>

              <div className="presets-list">
                {[10, 15, 20, 30, 45, 60].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`preset-chip ${intervaloSegundos === s ? 'active' : ''}`}
                    onClick={() => setIntervaloSegundos(s)}
                  >
                    {s} seg
                  </button>
                ))}
              </div>

            </div>

            {/* Barra de navegación inferior */}
            <div className="wizard-actions-bar">
              <button type="button" className="btn-back" onClick={() => setPasoActual(1)}>
                <span>⬅ Volver a Cafetería</span>
              </button>

              <button type="button" className="btn-next" onClick={() => setPasoActual(3)}>
                <span>Siguiente: Ingresar Datos</span>
                <span className="arrow-icon">➔</span>
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* PANTALLA 3: INGRESAR DATOS & VISUALIZAR EN TIEMPO REAL */}
        {/* ======================================================== */}
        {pasoActual === 3 && (
          <section className="wizard-card animated-step">
            {/* Información Rediseñada de la Simulación Activa */}
            <div className="simulation-info-strip">
              <div className="info-strip-card">
                <div className="info-strip-icon coffee-icon">☕</div>
                <div className="info-strip-content">
                  <span className="info-strip-label">Cafetería Activa</span>
                  <strong className="info-strip-value">{currentCafeteria?.nombre || 'Cafetería'}</strong>
                  <span className="info-strip-sub">📍 {currentCafeteria?.nombre_sede || 'Campus Central'}</span>
                </div>
              </div>

              <div className="info-strip-card">
                <div className="info-strip-icon clock-icon">⏱</div>
                <div className="info-strip-content">
                  <span className="info-strip-label">Frecuencia de Compra</span>
                  <strong className="info-strip-value">Cada {intervaloSegundos} segundos</strong>
                  <span className="info-strip-sub">Registro periódico continuo</span>
                </div>
              </div>

              <div className="info-strip-card">
                <div className={`info-strip-icon ${totalStockUnidades === 0 ? 'danger-icon' : 'stock-icon'}`}>
                  📦
                </div>
                <div className="info-strip-content">
                  <span className="info-strip-label">Inventario Disponible</span>
                  <strong className={`info-strip-value ${totalStockUnidades === 0 ? 'text-red' : 'text-green'}`}>
                    {totalStockUnidades} unidades
                  </strong>
                  <span className="info-strip-sub">
                    {totalStockUnidades === 0 ? (
                      <span className="badge-sub-danger">● Sin stock disponible</span>
                    ) : (
                      <span className="badge-sub-ok">● Niveles óptimos</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Toolbar para ingresar datos & Reponer inventario */}
            <div className="simulation-toolbar-box">
              <div className="toolbar-top">
                <h3 className="toolbar-heading">Ingreso de Datos & Control de Inventario</h3>
                <span className="toolbar-sub">Inicia la simulación para ver los datos insertándose en tiempo real</span>
              </div>

              <div className="actions-organized-layout">
                {/* 1. Botón Principal Hero: Simulación Automática */}
                <button
                  type="button"
                  className={`btn-hero-simulation ${simulando ? 'is-running' : 'is-idle'}`}
                  onClick={() => setSimulando(!simulando)}
                >
                  <span className="hero-btn-icon">{simulando ? '⏸' : '▶'}</span>
                  <div className="hero-btn-text">
                    <span className="hero-btn-title">
                      {simulando ? 'Pausar Simulación Automática' : 'Iniciar Simulación Automática'}
                    </span>
                    <span className="hero-btn-desc">
                      {simulando
                        ? `Simulación activa: registrando compras cada ${intervaloSegundos}s`
                        : `Registra automáticamente compras continuas cada ${intervaloSegundos} segundos`}
                    </span>
                  </div>
                  <span className="hero-btn-badge">
                    {simulando ? 'En ejecución' : `Cada ${intervaloSegundos}s`}
                  </span>
                </button>

                {/* 2. Fila de 3 Acciones Secundarias & Reposición */}
                <div className="aux-buttons-grid">
                  <button
                    type="button"
                    className="btn-aux"
                    disabled={actionLoading}
                    onClick={() => handleInsertarCompra(false)}
                    title="Inserta una sola compra inmediatamente"
                  >
                    <span className="aux-icon">🛒</span>
                    <div className="aux-text">
                      <span className="aux-title">Insertar 1 Compra</span>
                      <span className="aux-desc">Simulación puntual</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-aux"
                    disabled={actionLoading}
                    onClick={() => handleInsertarLote(5)}
                    title="Inserta 5 compras continuas"
                  >
                    <span className="aux-icon">⚡</span>
                    <div className="aux-text">
                      <span className="aux-title">Ráfaga x5</span>
                      <span className="aux-desc">5 compras en lote</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-aux btn-aux-restock"
                    disabled={actionLoading}
                    onClick={handleReponerInventario}
                    title="Restaura el stock de todos los productos"
                  >
                    <span className="aux-icon">📦</span>
                    <div className="aux-text">
                      <span className="aux-title">Reponer Inventario</span>
                      <span className="aux-desc">Recarga todo el stock</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Alerta de inventario agotado */}
              {sinStockCount > 0 && (
                <div className="alert-no-stock">
                  <span>⚠️</span>
                  <span>
                    Hay {sinStockCount} producto(s) sin stock disponible. Haz clic en{' '}
                    <strong>"Reponer Todo el Inventario"</strong> para recargar las unidades.
                  </span>
                </div>
              )}

              {/* Barra de progreso animada cuando está simulando */}
              {simulando && (
                <div className="live-progress-container">
                  <div className="progress-label-row">
                    <div className="pulsing-status">
                      <span className="green-pulse" />
                      <strong>Insertando datos automáticamente...</strong>
                    </div>
                    <span className="seconds-left">Próxima compra en {segundosRestantes}s</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${progresoIntervalo}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* MENÚ DESPLEGABLE: FLUJO DE PEDIDOS POR ESTADO (GRÁFICO)   */}
            {/* ======================================================== */}
            <div className="collapsible-menu-wrapper">
              <button
                type="button"
                className={`collapsible-menu-button ${mostrarFlujoPedidos ? 'is-open' : ''}`}
                onClick={() => setMostrarFlujoPedidos(!mostrarFlujoPedidos)}
              >
                <div className="menu-btn-left">
                  <span className="menu-icon">📊</span>
                  <div className="menu-text-group">
                    <span className="menu-main-label">Flujo de Pedidos por Estado</span>
                    <span className="menu-sub-label">
                      {mostrarFlujoPedidos
                        ? 'Haz clic aquí para plegar y ocultar el gráfico'
                        : 'Haz clic aquí para desplegar el gráfico de estados en tiempo real'}
                    </span>
                  </div>
                </div>

                <div className="menu-btn-right">
                  <span
                    className="badge-records-pill"
                    style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}
                  >
                    ✓ {estadisticas?.pedidos?.entregados ?? 0} entregados
                  </span>
                  <span className="badge-records-pill">
                    {(Number(estadisticas?.pedidos?.pendientes ?? 0) + Number(estadisticas?.pedidos?.preparando ?? 0))} en cocina
                  </span>
                  <span className={`menu-arrow ${mostrarFlujoPedidos ? 'arrow-up' : 'arrow-down'}`}>
                    {mostrarFlujoPedidos ? '▲ Ocultar' : '▼ Desplegar'}
                  </span>
                </div>
              </button>

              {/* Contenido desplegable: Tarjeta del Gráfico idéntico al panel del dueño */}
              {mostrarFlujoPedidos && (
                <div className="owner-flow-chart-card animated-dropdown">
                  {/* Encabezado con título del dueño y apartado especial de Entregados */}
                  <div className="owner-flow-header">
                    <div className="owner-flow-title-group">
                      <h4>Flujo de Pedidos por Estado</h4>
                      <p>Etapas activas del ciclo de atención (demoras de 1 a 10s entre fases)</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="live-indicator-pill">
                        <span className="live-pulse-dot" />
                        <span>
                          {procesosCafeteria.length > 0
                            ? `${procesosCafeteria.length} en preparación activa`
                            : 'Sincronizado con PostgreSQL'}
                        </span>
                      </div>

                      {/* Apartado Especial: Contador de Pedidos Entregados */}
                      <div className="owner-delivered-badge">
                        <div className="delivered-badge-circle">
                          ✓
                        </div>
                        <div className="delivered-badge-text">
                          <span className="delivered-badge-label">Entregados</span>
                          <span className="delivered-badge-count">
                            {estadisticas?.pedidos?.entregados ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico de Barras: Contenedor con Área de Barras y Eje X totalmente desacoplados */}
                  {(() => {
                    const pendientes = Number(estadisticas?.pedidos?.pendientes ?? 0);
                    const preparando = Number(estadisticas?.pedidos?.preparando ?? 0);
                    const listos = Number(estadisticas?.pedidos?.listos ?? 0);
                    const maxObserved = Math.max(pendientes, preparando, listos);
                    const yMax = maxObserved <= 2 ? 2 : maxObserved <= 4 ? 4 : maxObserved <= 6 ? 6 : Math.ceil(maxObserved / 5) * 5;
                    const yMid = Math.round(yMax / 2);
                    const yTicks = [yMax, yMid, 0];

                    const activeBars = [
                      {
                        name: 'Pendiente',
                        etapa: 'Pendientes',
                        cantidad: pendientes,
                        color: '#D9534F',
                        badgeBg: '#FFEBEE',
                        badgeColor: '#C62828',
                      },
                      {
                        name: 'En Prep.',
                        etapa: 'En Preparación',
                        cantidad: preparando,
                        color: '#F0AD4E',
                        badgeBg: '#FFF3E0',
                        badgeColor: '#E65100',
                      },
                      {
                        name: 'Listo',
                        etapa: 'Listos para Retiro',
                        cantidad: listos,
                        color: '#C86237',
                        badgeBg: '#FBE9E7',
                        badgeColor: '#BF360C',
                      },
                    ];

                    return (
                      <div className="owner-chart-container">
                        {/* 1. Área de gráfico (Eje Y + Líneas guía + Barras) */}
                        <div className="owner-chart-plot-area">
                          {/* Eje Y numérico y líneas guía punteadas */}
                          <div className="chart-y-axis">
                            {yTicks.map((tick, idx) => (
                              <div key={idx} className="chart-y-tick-row">
                                <span className="chart-y-label">{tick}</span>
                                <div className={`chart-grid-line ${tick === 0 ? 'chart-baseline' : ''}`} />
                              </div>
                            ))}
                          </div>

                          {/* Columnas con valor superior y barra vertical */}
                          <div className="owner-bars-columns">
                            {activeBars.map((bar) => {
                              const barHeightPx = bar.cantidad > 0 ? Math.max(8, Math.round((bar.cantidad / yMax) * 135)) : 0;
                              return (
                                <div
                                  key={bar.name}
                                  className="owner-bar-col"
                                  title={`${bar.cantidad} pedidos en ${bar.etapa}`}
                                >
                                  <span className="owner-bar-val-top">{bar.cantidad}</span>
                                  <div
                                    className="owner-bar-pillar"
                                    style={{
                                      height: `${barHeightPx}px`,
                                      backgroundColor: bar.color,
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Eje X Inferior (Totalmente desacoplado, sin posibilidad de solaparse con las barras) */}
                        <div className="owner-chart-xaxis">
                          <div className="owner-xaxis-spacer" />
                          <div className="owner-xaxis-cols">
                            {activeBars.map((bar) => (
                              <div key={bar.name} className="owner-xaxis-col">
                                <span className="owner-xaxis-name">{bar.name}</span>
                                <span
                                  className="owner-xaxis-badge"
                                  style={{
                                    backgroundColor: bar.badgeBg,
                                    color: bar.badgeColor,
                                  }}
                                >
                                  {bar.cantidad} ped.
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Resumen operativo al pie */}
                  <div className="owner-chart-footer">
                    <div className="footer-chip-group">
                      <span className="footer-chip-label">En cocina:</span>
                      <span className="chip-orange">
                        {(Number(estadisticas?.pedidos?.pendientes ?? 0) + Number(estadisticas?.pedidos?.preparando ?? 0))} activos
                      </span>
                    </div>

                    <div className="footer-chip-group">
                      <span className="footer-chip-label">Listos para retiro:</span>
                      <span className="chip-teal">
                        {Number(estadisticas?.pedidos?.listos ?? 0)} listos
                      </span>
                    </div>

                    <div className="footer-chip-group">
                      <span className="footer-chip-label">Total en BD:</span>
                      <span className="chip-brown">
                        {Number(estadisticas?.pedidos?.total_pedidos ?? 0)} pedidos
                      </span>
                    </div>
                  </div>

                  {/* Cola de Pedidos en Proceso Activo (Transición en vivo 1 a 10s) */}
                  <div className="active-process-queue-section" style={{ marginTop: '1.25rem' }}>
                    <div className="queue-section-header">
                      <div className="queue-section-title">
                        <span>🔥</span>
                        <span>Pedidos en Curso en Barra & Cocina</span>
                      </div>
                      <span className="queue-section-badge">
                        {procesosCafeteria.length} activo(s)
                      </span>
                    </div>

                    {procesosCafeteria.length === 0 ? (
                      <div className="queue-empty-box">
                        <span>☕</span>
                        <p>No hay pedidos en preparación activa en este instante.</p>
                        <small style={{ color: '#94a3b8' }}>
                          Pulsa <strong>"Insertar 1 Compra"</strong> o <strong>"Ráfaga x5"</strong> para ver cómo avanzan por las 4 fases con demoras aleatorias entre 1 y 10s.
                        </small>
                      </div>
                    ) : (
                      <div className="active-orders-grid">
                        {procesosCafeteria.map((proc) => {
                          const stageIdx = getStageIndex(proc.estadoActual);
                          return (
                            <div
                              key={proc.pedidoId}
                              className={`active-order-tile in-${proc.estadoActual}`}
                            >
                              <div className="tile-top-row">
                                <span className="tile-order-id">
                                  Pedido #{proc.pedidoId} • Retiro: {proc.codigoRetiro}
                                </span>
                                <span className="tile-customer-info">
                                  👤 {proc.cliente}
                                </span>
                                <span className="tile-price">
                                  ${Number(proc.total).toLocaleString('es-CL')}
                                </span>
                              </div>

                              <div className="tile-items-text">
                                📦 {proc.itemsResumen}
                              </div>

                              {/* Stepper visual interactivo de 4 pasos */}
                              <div className="tile-stepper-bar">
                                <div className={`tile-step-node ${stageIdx === 0 ? 'active in-pendiente' : stageIdx > 0 ? 'completed' : ''}`}>
                                  <span className="tile-step-bubble">
                                    {stageIdx > 0 ? '✓' : '1'}
                                  </span>
                                  <span className="tile-step-label">Pendiente</span>
                                </div>

                                <div className={`tile-connector-line ${stageIdx >= 1 ? 'filled' : ''}`} />

                                <div className={`tile-step-node ${stageIdx === 1 ? 'active in-preparando' : stageIdx > 1 ? 'completed' : ''}`}>
                                  <span className="tile-step-bubble">
                                    {stageIdx > 1 ? '✓' : '2'}
                                  </span>
                                  <span className="tile-step-label">En Prep.</span>
                                </div>

                                <div className={`tile-connector-line ${stageIdx >= 2 ? 'filled' : ''}`} />

                                <div className={`tile-step-node ${stageIdx === 2 ? 'active in-listo' : stageIdx > 2 ? 'completed' : ''}`}>
                                  <span className="tile-step-bubble">
                                    {stageIdx > 2 ? '✓' : '3'}
                                  </span>
                                  <span className="tile-step-label">Listo</span>
                                </div>

                                <div className={`tile-connector-line ${stageIdx >= 3 ? 'filled' : ''}`} />

                                <div className={`tile-step-node ${stageIdx === 3 ? 'completed' : ''}`}>
                                  <span className="tile-step-bubble">
                                    {stageIdx === 3 ? '✓' : '4'}
                                  </span>
                                  <span className="tile-step-label">Entregado</span>
                                </div>
                              </div>

                              {/* Banner de próxima transición con temporizador */}
                              <div className="tile-next-transition-box">
                                <div className="transition-info">
                                  <span>
                                    {proc.estadoActual === 'pendiente' && '⏳ Pedido en cola'}
                                    {proc.estadoActual === 'preparando' && '🍳 Cocinando / elaborando'}
                                    {proc.estadoActual === 'listo' && '🔔 Listo para entrega'}
                                  </span>
                                  <span>➔</span>
                                  <span>
                                    {proc.siguienteEstado
                                      ? `Avanza a "${proc.siguienteEstado.toUpperCase()}" en:`
                                      : 'Finalizando pedido...'}
                                  </span>
                                  <span className="transition-timer-badge">
                                    ~{proc.segundosRestantes}s
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className="btn-fast-forward"
                                  onClick={() => handleAvanzarPaso(proc.pedidoId)}
                                  title="Avanzar manualmente a la siguiente fase sin esperar la demora"
                                >
                                  ⚡ Avanzar ahora
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* MENÚ DESPLEGABLE: VISUALIZACIÓN DE INSERCIÓN EN TIEMPO REAL */}
            {/* (Solo se visualiza si se despliega el menú) */}
            {/* ======================================================== */}
            <div className="collapsible-menu-wrapper">
              <button
                type="button"
                className={`collapsible-menu-button ${mostrarMenuVisualizacion ? 'is-open' : ''}`}
                onClick={() => setMostrarMenuVisualizacion(!mostrarMenuVisualizacion)}
              >
                <div className="menu-btn-left">
                  <span className="menu-icon">{mostrarMenuVisualizacion ? '📂' : '📁'}</span>
                  <div className="menu-text-group">
                    <span className="menu-main-label">Visualización de Inserción en Tiempo Real</span>
                    <span className="menu-sub-label">
                      {mostrarMenuVisualizacion
                        ? 'Haz clic aquí para plegar y ocultar la visualización'
                        : 'Haz clic aquí para desplegar el menú y ver los datos en vivo'}
                    </span>
                  </div>
                </div>

                <div className="menu-btn-right">
                  <span className="badge-records-pill">
                    {sessionCompras > 0 ? `${sessionCompras} compras en sesión` : `${pedidosInsertados.length} en BD`}
                  </span>
                  <span className={`menu-arrow ${mostrarMenuVisualizacion ? 'arrow-up' : 'arrow-down'}`}>
                    {mostrarMenuVisualizacion ? '▲ Ocultar' : '▼ Desplegar'}
                  </span>
                </div>
              </button>

              {/* Contenido que SOLO se muestra si se despliega el menú */}
              {mostrarMenuVisualizacion && (
                <div className="visualizer-container animated-dropdown">
                  <div className="visualizer-header">
                    <div>
                      <h3 className="visualizer-title">Datos Insertados en Tiempo Real</h3>
                      <p className="visualizer-desc">Información actualizada directamente desde la base de datos</p>
                    </div>

                    <div className="session-metrics-pills">
                      <div className="metric-pill">
                        <span className="metric-tag">Compras Sesión:</span>
                        <strong>{sessionCompras}</strong>
                      </div>
                      <div className="metric-pill">
                        <span className="metric-tag">Unidades:</span>
                        <strong>{sessionItems} u.</strong>
                      </div>
                      <div className="metric-pill highlight">
                        <span className="metric-tag">Facturado:</span>
                        <strong>${sessionTotal.toLocaleString('es-CL')}</strong>
                      </div>
                      {estadisticas && (
                        <>
                          <div className="metric-pill" title="Pedidos pendientes de atención">
                            <span className="metric-tag">Pendientes:</span>
                            <strong style={{ color: '#d97706' }}>{estadisticas.pedidos?.pendientes || 0}</strong>
                          </div>
                          <div className="metric-pill" title="Pedidos en preparación en cocina">
                            <span className="metric-tag">En Prep.:</span>
                            <strong style={{ color: '#2563eb' }}>{estadisticas.pedidos?.preparando || 0}</strong>
                          </div>
                          <div className="metric-pill" title="Pedidos listos para retiro">
                            <span className="metric-tag">Listos:</span>
                            <strong style={{ color: '#0d9488' }}>{estadisticas.pedidos?.listos || 0}</strong>
                          </div>
                          <div className="metric-pill" title="Pedidos entregados con éxito">
                            <span className="metric-tag">Entregados:</span>
                            <strong style={{ color: '#16a34a' }}>{estadisticas.pedidos?.entregados || 0}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Banner destacado de la última inserción */}
                  {ultimoPedidoInsertado && (
                    <div className={`new-insert-banner ${animatingId ? 'banner-glow' : ''}`}>
                      <div className="insert-badge">
                        <span className="dot-green" />
                        <span>ÚLTIMA COMPRA INSERTADA EN POSTGRESQL</span>
                      </div>

                      <div className="insert-grid">
                        <div className="insert-col">
                          <span className="col-label">Pedido / Código:</span>
                          <strong className="col-value code">
                            #{ultimoPedidoInsertado.id} • {ultimoPedidoInsertado.codigo_retiro_diario}
                          </strong>
                        </div>

                        <div className="insert-col">
                          <span className="col-label">Cliente (Estudiante):</span>
                          <strong className="col-value">
                            👤 {ultimoPedidoInsertado.cliente || ultimoPedidoInsertado.usuario_nombre || 'Estudiante'}
                          </strong>
                        </div>

                        <div className="insert-col">
                          <span className="col-label">Productos Comprados:</span>
                          <strong className="col-value">
                            {ultimoPedidoInsertado.items && ultimoPedidoInsertado.items.length > 0
                              ? ultimoPedidoInsertado.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')
                              : '1x Compra de cafetería'}
                          </strong>
                        </div>

                        <div className="insert-col">
                          <span className="col-label">Total Facturado:</span>
                          <strong className="col-value price">
                            ${Number(ultimoPedidoInsertado.total).toLocaleString('es-CL')}
                          </strong>
                        </div>

                        <div className="insert-col">
                          <span className="col-label">Estado en BD:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {renderEstadoBadge(ultimoPedidoInsertado.estado)}
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Pago: {ultimoPedidoInsertado.pago_estado?.toUpperCase() || 'PAGADO'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {renderMiniPipeline(ultimoPedidoInsertado.estado)}
                    </div>
                  )}

                  {/* Línea de tiempo / Historial visual de compras insertadas */}
                  <div className="timeline-feed-box">
                    <div className="feed-top-bar">
                      <span className="feed-title">Historial de Compras Insertadas</span>
                      <span className="feed-count">{pedidosInsertados.length} registradas</span>
                    </div>

                    {pedidosInsertados.length === 0 ? (
                      <div className="feed-empty-state">
                        <span>☕ Esperando inserción de compras...</span>
                        <p>Inicia la simulación o pulsa "Insertar 1 Compra" para ver el flujo en vivo.</p>
                      </div>
                    ) : (
                      <div className="feed-cards-stream">
                        {pedidosInsertados.map((ped, index) => {
                          const isNewest = animatingId === ped.id || index === 0;
                          const itemsStr =
                            ped.items && ped.items.length > 0
                              ? ped.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')
                              : '1x Compra';

                          const timeStr = ped.creado_en
                            ? new Date(ped.creado_en).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : 'Ahora';

                          return (
                            <div
                              key={ped.id}
                              className={`stream-item-card ${isNewest ? 'item-highlight' : ''}`}
                            >
                              <div className="stream-card-header">
                                <span className="stream-code">
                                  #{ped.id} • {ped.codigo_retiro_diario}
                                </span>
                                <span className="stream-time">{timeStr}</span>
                              </div>

                              <div className="stream-card-body">
                                <div className="stream-details">
                                  <span className="stream-buyer">
                                    👤 {ped.cliente || (ped.usuario_nombre ? `${ped.usuario_nombre} ${ped.usuario_apellido || ''}` : 'Estudiante')}
                                  </span>
                                  <span className="stream-items">{itemsStr}</span>
                                </div>

                                <div className="stream-price">
                                  ${Number(ped.total).toLocaleString('es-CL')}
                                </div>
                              </div>

                              <div className="stream-card-footer">
                                <span className="stream-payment">💳 {ped.metodo_pago || 'Webpay Plus'}</span>
                                <div>
                                  {renderEstadoBadge(ped.estado)}
                                </div>
                              </div>

                              {renderMiniPipeline(ped.estado)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de navegación inferior para volver a pasos anteriores */}
            <div className="wizard-actions-bar" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn-back"
                onClick={() => {
                  setSimulando(false);
                  setPasoActual(2);
                }}
              >
                <span>⬅ Volver al Tiempo de Intervalo</span>
              </button>
              <div />
            </div>
          </section>
        )}
      </main>

      {/* Notificaciones Toast flotantes */}
      {toast && (
        <div className={`floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}</span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button type="button" className="toast-dismiss" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
