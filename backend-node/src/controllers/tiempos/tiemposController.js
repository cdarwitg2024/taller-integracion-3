const EstimacionService = require('../../services/tiempos/estimacionService');
const ColasService = require('../../services/tiempos/colasService');
const CafeteriaModel = require('../../models/tiempos/cafeteriaModel');

class TiemposController {
  /**
   * GET /api/tiempos/estimacion/:cafeteriaId
   * Obtener tiempo estimado para una cafetería específica
   */
  static async getTiempoEstimado(req, res) {
    try {
      const { cafeteriaId } = req.params;
      const { hora } = req.query;
      
      // Validar entrada
      if (!cafeteriaId) {
        return res.status(400).json({
          success: false,
          error: 'cafeteriaId es requerido'
        });
      }
      
      // Validar que la cafetería existe
      const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
      if (!cafeteria) {
        return res.status(404).json({
          success: false,
          error: `Cafetería con ID ${cafeteriaId} no encontrada`
        });
      }
      
      const estimacion = EstimacionService.obtenerEstimacion(cafeteriaId, hora);
      
      res.status(200).json({
        success: true,
        data: estimacion
      });
    } catch (error) {
      console.error('Error en getTiempoEstimado:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/tiempos/estimacion
   * Obtener tiempos estimados para todas las cafeterías
   */
  static async getTiemposAll(req, res) {
    try {
      const { hora } = req.query;
      
      const resultados = EstimacionService.obtenerEstimacionesAll(hora);
      
      res.status(200).json({
        success: true,
        data: resultados
      });
    } catch (error) {
      console.error('Error en getTiemposAll:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/tiempos/recomendaciones/:cafeteriaId
   * Obtener recomendaciones de cafeterías alternativas
   */
  static async getRecomendaciones(req, res) {
    try {
      const { cafeteriaId } = req.params;
      const { hora, limite } = req.query;
      
      if (!cafeteriaId) {
        return res.status(400).json({
          success: false,
          error: 'cafeteriaId es requerido'
        });
      }
      
      const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
      if (!cafeteria) {
        return res.status(404).json({
          success: false,
          error: `Cafetería con ID ${cafeteriaId} no encontrada`
        });
      }
      
      const limiteNum = limite ? parseInt(limite) : 3;
      const recomendaciones = EstimacionService.obtenerRecomendaciones(
        cafeteriaId, 
        hora, 
        limiteNum
      );
      
      res.status(200).json({
        success: true,
        data: recomendaciones
      });
    } catch (error) {
      console.error('Error en getRecomendaciones:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/tiempos/simular/llegada
   * Simular llegada de nuevos pedidos (para pruebas)
   */
  static async simularLlegada(req, res) {
    try {
      const { cafeteriaId, cantidad = 1 } = req.body;
      
      if (!cafeteriaId) {
        return res.status(400).json({
          success: false,
          error: 'cafeteriaId es requerido'
        });
      }
      
      const cafeteria = CafeteriaModel.getCafeteriaById(cafeteriaId);
      if (!cafeteria) {
        return res.status(404).json({
          success: false,
          error: `Cafetería con ID ${cafeteriaId} no encontrada`
        });
      }
      
      // Simular llegada de pedidos
      const pedidosSimulados = [];
      const productosEjemplo = [
        ['Café Americano', 'Croissant'],
        ['Latte', 'Sándwich'],
        ['Cappuccino', 'Muffin'],
        ['Té', 'Galleta'],
        ['Jugo', 'Empanada']
      ];
      
      for (let i = 0; i < Math.min(cantidad, 5); i++) {
        const productos = productosEjemplo[Math.floor(Math.random() * productosEjemplo.length)];
        const pedido = {
          cafeteria_id: cafeteriaId,
          productos: productos,
          estado: 'preparacion',
          cliente_id: `sim_${Date.now()}_${i}`
        };
        const nuevoPedido = CafeteriaModel.agregarPedido(pedido);
        pedidosSimulados.push(nuevoPedido);
      }
      
      const pedidosActivos = CafeteriaModel.getPedidosActivos(cafeteriaId);
      
      res.status(200).json({
        success: true,
        message: `Se simularon ${pedidosSimulados.length} pedidos en ${cafeteria.nombre}`,
        data: {
          pedidos_simulados: pedidosSimulados,
          total_activos: pedidosActivos.length,
          cafeteria: {
            id: cafeteria.id,
            nombre: cafeteria.nombre
          }
        }
      });
    } catch (error) {
      console.error('Error en simularLlegada:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/tiempos/metricas
   * Calcular métricas de cola con parámetros personalizados
   */
  static async calcularMetricas(req, res) {
    try {
      const { cafeteriaId, tasaLlegada } = req.body;
      
      if (!cafeteriaId || tasaLlegada === undefined) {
        return res.status(400).json({
          success: false,
          error: 'cafeteriaId y tasaLlegada son requeridos'
        });
      }
      
      const metricas = ColasService.calcularMetricasCola(cafeteriaId, tasaLlegada);
      
      res.status(200).json({
        success: true,
        data: metricas
      });
    } catch (error) {
      console.error('Error en calcularMetricas:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/tiempos/cafeterias
   * Obtener todas las cafeterías
   */
  static async getCafeterias(req, res) {
    try {
      const cafeterias = CafeteriaModel.getAllCafeterias();
      
      res.status(200).json({
        success: true,
        data: cafeterias
      });
    } catch (error) {
      console.error('Error en getCafeterias:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = TiemposController;