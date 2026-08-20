const CafeteriaModel = require('../../models/tiempos/cafeteriaModel');

class ColasService {
  /**
   * Calcula métricas de cola usando modelo M/M/1
   * @param {string} cafeteriaId - ID de la cafetería
   * @param {number} tasaLlegada - λ (tasa de llegada en clientes/minuto)
   * @returns {Object} Métricas calculadas
   */
  static calcularMetricasCola(cafeteriaId, tasaLlegada) {
    const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
    if (!cafeteria) {
      throw new Error(`Cafetería con ID ${cafeteriaId} no encontrada`);
    }

    // Validar que la tasa de llegada sea menor que la tasa de servicio (estabilidad)
    const mu = cafeteria.tasa_servicio;
    const lambda = tasaLlegada;

    if (lambda >= mu) {
      throw new Error('La tasa de llegada debe ser menor que la tasa de servicio para sistema estable');
    }

    // Factor de utilización (ρ = λ/μ)
    const rho = lambda / mu;

    // Número promedio de clientes en el sistema (L = λ/(μ-λ))
    const L = lambda / (mu - lambda);

    // Número promedio en cola (Lq = λ²/(μ(μ-λ)))
    const Lq = Math.pow(lambda, 2) / (mu * (mu - lambda));

    // Tiempo promedio en el sistema (W = 1/(μ-λ))
    const W = 1 / (mu - lambda);

    // Tiempo promedio en cola (Wq = λ/(μ(μ-λ)))
    const Wq = lambda / (mu * (mu - lambda));

    // Probabilidad de que el sistema esté vacío (P0 = 1 - ρ)
    const P0 = 1 - rho;

    // Probabilidad de que haya n clientes en el sistema
    const probabilidades = (n) => Math.pow(rho, n) * P0;

    return {
      cafeteria_id: cafeteriaId,
      tasa_llegada: lambda,
      tasa_servicio: mu,
      factor_utilizacion: rho,
      clientes_promedio_sistema: L,
      clientes_promedio_cola: Lq,
      tiempo_promedio_sistema: W, // minutos
      tiempo_promedio_cola: Wq, // minutos
      prob_sistema_vacio: P0,
      nivel_congestion: this.obtenerNivelCongestion(rho),
      probabilidad_n_clientes: probabilidades
    };
  }

  /**
   * Determina nivel de congestión basado en factor de utilización
   */
  static obtenerNivelCongestion(rho) {
    if (rho < 0.3) return 'BAJA';
    if (rho < 0.5) return 'MEDIA_BAJA';
    if (rho < 0.7) return 'MEDIA';
    if (rho < 0.85) return 'ALTA';
    return 'SATURADA';
  }

  /**
   * Calcula tiempo de espera considerando pedidos actuales
   */
  static calcularTiempoEspera(cafeteriaId, tasaLlegada) {
    const metricas = this.calcularMetricasCola(cafeteriaId, tasaLlegada);
    const pedidosActivos = CafeteriaModel.getPedidosActivos(cafeteriaId);
    
    // Pedidos en preparación
    const pedidosEnPreparacion = pedidosActivos.filter(p => p.estado === 'preparacion').length;
    const pedidosPendientes = pedidosActivos.filter(p => p.estado === 'pendiente').length;
    
    // Tiempo base de cola
    const tiempoBase = metricas.tiempo_promedio_cola;
    
    // Ajuste por pedidos actuales
    const factorAjuste = 1 + (pedidosEnPreparacion * 0.3) + (pedidosPendientes * 0.2);
    const tiempoEstimado = tiempoBase * factorAjuste;
    
    // Calcular tiempo de preparación estimado
    const tiempoPreparacion = this.estimarTiempoPreparacion(pedidosActivos);
    
    return {
      cafeteria_id: cafeteriaId,
      tiempo_estimado_espera: Math.round(tiempoEstimado * 10) / 10,
      tiempo_estimado_preparacion: Math.round(tiempoPreparacion * 10) / 10,
      tiempo_total_estimado: Math.round((tiempoEstimado + tiempoPreparacion) * 10) / 10,
      pedidos_en_cola: pedidosEnPreparacion,
      pedidos_pendientes: pedidosPendientes,
      nivel_congestion: metricas.nivel_congestion,
      detalle: {
        ...metricas,
        pedidos_activos: pedidosActivos.length
      }
    };
  }

  /**
   * Estima tiempo de preparación basado en pedidos actuales
   */
  static estimarTiempoPreparacion(pedidos) {
    // Tiempo promedio por pedido en minutos
    const TIEMPO_PROMEDIO_PEDIDO = 1.5;
    const pedidosEnPreparacion = pedidos.filter(p => p.estado === 'preparacion');
    return pedidosEnPreparacion.length * TIEMPO_PROMEDIO_PEDIDO;
  }

  /**
   * Recomienda cafeterías alternativas
   */
  static recomendarAlternativas(cafeteriaIdExcluida, tasaLlegada, limite = 3) {
    const cafeterias = CafeteriaModel.getCafeteriasActivas();
    const alternativas = [];

    for (const cafe of cafeterias) {
      if (cafe.id === cafeteriaIdExcluida) continue;
      
      try {
        const estimacion = this.calcularTiempoEspera(cafe.id, tasaLlegada);
        if (estimacion.nivel_congestion !== 'SATURADA') {
          alternativas.push({
            cafeteria: {
              id: cafe.id,
              nombre: cafe.nombre,
              ubicacion: cafe.ubicacion
            },
            tiempo_espera: estimacion.tiempo_estimado_espera,
            nivel_congestion: estimacion.nivel_congestion,
            pedidos_en_cola: estimacion.pedidos_en_cola
          });
        }
      } catch (error) {
        console.warn(`Error calculando para ${cafe.id}:`, error.message);
      }
    }

    // Ordenar por menor tiempo de espera
    alternativas.sort((a, b) => a.tiempo_espera - b.tiempo_espera);
    
    return alternativas.slice(0, limite);
  }
}

module.exports = ColasService;