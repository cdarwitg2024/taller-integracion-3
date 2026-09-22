const ColasService = require('./colasService');
const CafeteriaModel = require('../../models/tiempos/cafeteriaModel');

class EstimacionService {
  /**
   * Simula tasa de llegada basada en hora y día
   */
  static simularTasaLlegada(hora = null, dia = null) {
    const horaActual = hora || new Date().toTimeString().slice(0, 5);
    const horaNum = parseInt(horaActual.split(':')[0]);
    const minutos = parseInt(horaActual.split(':')[1]);
    const horaDecimal = horaNum + minutos / 60;
    
    // Patrones de demanda según hora
    let tasaBase = 0.5; // Base
    
    // Picos de demanda (recreos de 10-15 min)
    // 10:00-10:15, 12:00-13:00, 16:00-16:15
    if (horaDecimal >= 10 && horaDecimal <= 10.25) {
      tasaBase = 1.8 + Math.random() * 0.4;
    } else if (horaDecimal >= 12 && horaDecimal <= 13) {
      tasaBase = 2.0 + Math.random() * 0.5;
    } else if (horaDecimal >= 16 && horaDecimal <= 16.25) {
      tasaBase = 1.6 + Math.random() * 0.3;
    } else if (horaDecimal >= 8 && horaDecimal < 9) {
      tasaBase = 0.8 + Math.random() * 0.3;
    } else if (horaDecimal >= 15 && horaDecimal < 16) {
      tasaBase = 0.7 + Math.random() * 0.3;
    } else if (horaDecimal >= 17 && horaDecimal < 18) {
      tasaBase = 0.6 + Math.random() * 0.3;
    } else {
      tasaBase = 0.3 + Math.random() * 0.2;
    }
    
    // Ajuste por día (ej: viernes mayor demanda)
    if (dia) {
      const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      if (dia === 'viernes') {
        tasaBase *= 1.2;
      } else if (dia === 'lunes') {
        tasaBase *= 0.9;
      }
    }
    
    return Math.round(tasaBase * 100) / 100;
  }

  /**
   * Simula datos de llegada para una cafetería
   */
  static simularLlegadas(cafeteriaId, hora = null) {
    const horaActual = hora || new Date().toTimeString().slice(0, 5);
    const tasa = this.simularTasaLlegada(horaActual);
    
    // Obtener pedidos activos reales
    const pedidosActivos = CafeteriaModel.getPedidosActivos(cafeteriaId);
    const pedidosEnPreparacion = pedidosActivos.filter(p => p.estado === 'preparacion').length;
    const pedidosPendientes = pedidosActivos.filter(p => p.estado === 'pendiente').length;
    
    return {
      cafeteria_id: cafeteriaId,
      tasa_llegada: tasa,
      pedidos_en_preparacion: pedidosEnPreparacion,
      pedidos_pendientes: pedidosPendientes,
      total_pedidos_activos: pedidosActivos.length,
      hora_consulta: horaActual,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene estimación completa de tiempos
   */
  static obtenerEstimacion(cafeteriaId, hora = null) {
    const datosLlegada = this.simularLlegadas(cafeteriaId, hora);
    
    const estimacion = ColasService.calcularTiempoEspera(
      cafeteriaId,
      datosLlegada.tasa_llegada
    );
    
    // Obtener información de la cafetería
    const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
    
    return {
      cafeteria: {
        id: cafeteriaId,
        nombre: cafeteria ? cafeteria.nombre : 'Desconocida',
        ubicacion: cafeteria ? cafeteria.ubicacion : 'N/A'
      },
      estimacion: {
        tiempo_espera: estimacion.tiempo_estimado_espera,
        tiempo_preparacion: estimacion.tiempo_estimado_preparacion,
        tiempo_total: estimacion.tiempo_total_estimado,
        nivel_congestion: estimacion.nivel_congestion,
        pedidos_en_cola: estimacion.pedidos_en_cola,
        pedidos_pendientes: estimacion.pedidos_pendientes
      },
      detalle_tecnico: {
        tasa_llegada: datosLlegada.tasa_llegada,
        tasa_servicio: estimacion.detalle.tasa_servicio,
        factor_utilizacion: estimacion.detalle.factor_utilizacion,
        clientes_promedio: estimacion.detalle.clientes_promedio_sistema,
        prob_sistema_vacio: estimacion.detalle.prob_sistema_vacio
      },
      timestamp: datosLlegada.timestamp,
      hora_consulta: datosLlegada.hora_consulta
    };
  }

  /**
   * Obtiene estimaciones para todas las cafeterías activas
   */
  static obtenerEstimacionesAll(hora = null) {
    const cafeterias = CafeteriaModel.getCafeteriasActivas();
    const resultados = [];
    
    for (const cafe of cafeterias) {
      try {
        const estimacion = this.obtenerEstimacion(cafe.id, hora);
        resultados.push(estimacion);
      } catch (error) {
        console.error(`Error estimando ${cafe.id}:`, error.message);
        resultados.push({
          cafeteria: {
            id: cafe.id,
            nombre: cafe.nombre,
            ubicacion: cafe.ubicacion
          },
          error: error.message,
          estimacion: null
        });
      }
    }
    
    // Ordenar por menor tiempo de espera
    resultados.sort((a, b) => {
      if (!a.estimacion) return 1;
      if (!b.estimacion) return -1;
      return a.estimacion.tiempo_espera - b.estimacion.tiempo_espera;
    });
    
    return {
      total_cafeterias: resultados.length,
      timestamp: new Date().toISOString(),
      resultados
    };
  }

  /**
   * Obtiene recomendaciones de cafeterías alternativas
   */
  static obtenerRecomendaciones(cafeteriaId, hora = null, limite = 3) {
    const tasa = this.simularTasaLlegada(hora);
    const alternativas = ColasService.recomendarAlternativas(cafeteriaId, tasa, limite);
    
    const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
    
    return {
      cafeteria_actual: {
        id: cafeteriaId,
        nombre: cafeteria ? cafeteria.nombre : 'Desconocida',
        ubicacion: cafeteria ? cafeteria.ubicacion : 'N/A'
      },
      alternativas: alternativas,
      total_alternativas: alternativas.length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = EstimacionService;