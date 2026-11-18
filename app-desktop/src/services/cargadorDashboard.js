import { pedidosService as pedidosServiceOriginal } from './pedidosService';

export function normalizarCafeteriaId(id) {
  return id === null || id === undefined ? null : String(id).trim() || null;
}

export function crearEstadoInicialDashboard(cafeteriaId = null) {
  return {
    cafeteriaId,
    stats: null,
    pedidos: [],
    salesData: [],
    topProducts: [],
    loading: true,
    dbError: null,
    ultimaActualizacionExitosa: null,
  };
}

/**
 * Controlador de ciclo de vida y carga para el Dashboard del dueño (S3-T2).
 * Responsabilidades:
 * 1. Invalidar cargas pendientes ante cambio de cafetería o desmontaje.
 * 2. Descartar respuestas desordenadas/invertidas (out-of-order responses).
 * 3. Limpiar inmediatamente los indicadores del contexto anterior para no mostrarlos
 *    mientras se procesa una nueva cafetería.
 */
export function crearCargadorDashboard({
  pedidosService = pedidosServiceOriginal,
  onEstadoCambiado = () => {},
  obtenerFechaActual = () => new Date().toISOString(),
} = {}) {
  let requestId = 0;
  let activo = true;
  let cafeteriaActual = null;

  let estado = crearEstadoInicialDashboard();

  const notificar = () => {
    if (activo && onEstadoCambiado) {
      onEstadoCambiado({ ...estado });
    }
  };

  const ejecutarCarga = async (cafeteria, currentRequestId, showLoading) => {
    if (showLoading) {
      estado.loading = true;
      estado.dbError = null;
      notificar();
    }

    try {
      const pedidosRes = await pedidosService.getAll({ cafeteriaId: cafeteria });
      if (!activo || currentRequestId !== requestId) return;

      const [resStats, resSales, resTop] = await Promise.all([
        pedidosService.getEstadisticas(pedidosRes),
        pedidosService.getVentasPorHora(pedidosRes),
        pedidosService.getTopProductos(pedidosRes),
      ]);
      if (!activo || currentRequestId !== requestId) return;

      estado.stats = resStats;
      estado.pedidos = pedidosRes;
      estado.salesData = resSales;
      estado.topProducts = resTop;
      estado.ultimaActualizacionExitosa = obtenerFechaActual();
      estado.dbError = null;
    } catch (err) {
      if (!activo || currentRequestId !== requestId) return;
      estado.dbError =
        err.message || 'No se pudieron consultar los datos del Dashboard.';
      estado.stats = null;
      estado.pedidos = [];
      estado.salesData = [];
      estado.topProducts = [];
    } finally {
      if (activo && currentRequestId === requestId) {
        // La carga vigente cierra también un indicador abierto por una
        // solicitud anterior, aunque este refresco haya sido silencioso.
        estado.loading = false;
        notificar();
      }
    }
  };

  return {
    activar() {
      activo = true;
    },

    cambiarCafeteria(nuevaCafeteriaId) {
      activo = true;
      cafeteriaActual = normalizarCafeteriaId(nuevaCafeteriaId);
      requestId++;
      const currentRequestId = requestId;

      // Criterio S3-T2: No mostrar indicadores del contexto anterior
      estado = crearEstadoInicialDashboard(cafeteriaActual);

      if (cafeteriaActual === null) {
        estado.dbError =
          'Tu usuario no tiene una cafetería autorizada asociada. No es posible calcular los indicadores.';
        estado.loading = false;
        notificar();
        return;
      }

      notificar();
      return ejecutarCarga(cafeteriaActual, currentRequestId, true);
    },

    refrescar(showLoading = false) {
      if (!activo) return;
      if (
        cafeteriaActual === null ||
        cafeteriaActual === undefined ||
        cafeteriaActual === ''
      ) {
        return;
      }
      requestId++;
      const currentRequestId = requestId;
      return ejecutarCarga(cafeteriaActual, currentRequestId, showLoading);
    },

    desmontar() {
      activo = false;
      requestId++;
    },

    obtenerEstado() {
      return { ...estado };
    },

    obtenerRequestId() {
      return requestId;
    },
  };
}

export default crearCargadorDashboard;
