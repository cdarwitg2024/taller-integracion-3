import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import {
  getDbStatus,
  getCafeterias,
  getProductos,
  getUltimosPedidos,
  getEstadisticas,
  getProcesosCafeteria,
  avanzarPasoProceso,
  simularCompra,
  reponerInventario,
  reponerProductoIndividual,
} from './db.ts';

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json());

// 1. Estado de conexión con la Base de Datos
apiApp.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const status = await getDbStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Listado de Cafeterías existentes
apiApp.get('/api/cafeterias', async (_req: Request, res: Response) => {
  try {
    const cafeterias = await getCafeterias();
    res.json(cafeterias);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Productos y stock de una cafetería
apiApp.get('/api/cafeterias/:id/productos', async (req: Request, res: Response) => {
  try {
    const cafeteriaId = parseInt(String(req.params.id), 10);
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'ID de cafetería inválido' });
    }
    const prods = await getProductos(cafeteriaId);
    res.json(prods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Últimos pedidos de una cafetería
apiApp.get('/api/cafeterias/:id/pedidos', async (req: Request, res: Response) => {
  try {
    const cafeteriaId = parseInt(String(req.params.id), 10);
    const limit = parseInt(req.query.limit as string, 10) || 15;
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'ID de cafetería inválido' });
    }
    const pedidos = await getUltimosPedidos(cafeteriaId, limit);
    res.json(pedidos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Estadísticas de una cafetería
apiApp.get('/api/cafeterias/:id/estadisticas', async (req: Request, res: Response) => {
  try {
    const cafeteriaId = parseInt(String(req.params.id), 10);
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'ID de cafetería inválido' });
    }
    const stats = await getEstadisticas(cafeteriaId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1. Monitoreo en vivo del proceso de la cafetería (Pendiente -> Preparación -> Listo -> Entregado)
apiApp.get('/api/cafeterias/:id/proceso-cafeteria', (req: Request, res: Response) => {
  try {
    const cafeteriaId = parseInt(String(req.params.id), 10);
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'ID de cafetería inválido' });
    }
    const data = getProcesosCafeteria(cafeteriaId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.2. Avanzar manualmente una etapa de un pedido activo (para pruebas o supervisión)
apiApp.post('/api/pedidos/:id/avanzar-proceso', async (req: Request, res: Response) => {
  try {
    const pedidoId = parseInt(String(req.params.id), 10);
    if (isNaN(pedidoId)) {
      return res.status(400).json({ error: 'ID de pedido inválido' });
    }
    const resultado = await avanzarPasoProceso(pedidoId);
    if (!resultado) {
      return res.status(404).json({ error: 'Pedido no encontrado en proceso activo' });
    }
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Simular una compra individual (inicia por defecto flujo de cafetería entre 1 y 10s por etapa)
apiApp.post('/api/simular-compra', async (req: Request, res: Response) => {
  try {
    const { cafeteria_id, estado, proceso_cafeteria, delay_min, delay_max } = req.body;
    const cafeteriaId = parseInt(cafeteria_id, 10);
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'cafeteria_id es obligatorio' });
    }
    const resultado = await simularCompra(cafeteriaId, {
      estado,
      procesoCafeteria: proceso_cafeteria !== undefined ? Boolean(proceso_cafeteria) : true,
      delayMin: delay_min ? parseInt(delay_min, 10) : 1,
      delayMax: delay_max ? parseInt(delay_max, 10) : 10,
    });
    res.json(resultado);
  } catch (err: any) {
    const isOutOfStock = err.message && err.message.includes('INVENTARIO_AGOTADO');
    res.status(isOutOfStock ? 409 : 500).json({
      error: err.message,
      inventarioAgotado: isOutOfStock,
    });
  }
});

// 7. Simular un lote de compras (ej: ráfaga de 5 pedidos escalonados en el proceso de cocina)
apiApp.post('/api/simular-lote', async (req: Request, res: Response) => {
  try {
    const { cafeteria_id, cantidad = 5, estado, proceso_cafeteria, delay_min, delay_max } = req.body;
    const cafeteriaId = parseInt(cafeteria_id, 10);
    const count = Math.min(Math.max(1, parseInt(cantidad, 10) || 5), 20);

    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'cafeteria_id es obligatorio' });
    }

    const pedidosCreados: any[] = [];
    const alertasGeneradas: any[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const sim = await simularCompra(cafeteriaId, {
          estado,
          procesoCafeteria: proceso_cafeteria !== undefined ? Boolean(proceso_cafeteria) : true,
          delayMin: delay_min ? parseInt(delay_min, 10) : 1,
          delayMax: delay_max ? parseInt(delay_max, 10) : 10,
        });
        pedidosCreados.push(sim.pedido);
        if (sim.alertasStock && sim.alertasStock.length > 0) {
          alertasGeneradas.push(...sim.alertasStock);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('INVENTARIO_AGOTADO')) {
          break;
        }
        throw err;
      }
    }

    res.json({
      success: true,
      solicitados: count,
      creados: pedidosCreados.length,
      pedidos: pedidosCreados,
      alertasStock: alertasGeneradas,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Reponer todo el inventario de una cafetería
apiApp.post('/api/reponer-inventario', async (req: Request, res: Response) => {
  try {
    const { cafeteria_id, unidades } = req.body;
    const cafeteriaId = parseInt(cafeteria_id, 10);
    if (isNaN(cafeteriaId)) {
      return res.status(400).json({ error: 'cafeteria_id es obligatorio' });
    }
    const resultado = await reponerInventario(cafeteriaId, unidades ? parseInt(unidades, 10) : 30);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reponer un producto individual
apiApp.post('/api/reponer-producto', async (req: Request, res: Response) => {
  try {
    const { producto_id, incremento } = req.body;
    const prodId = parseInt(producto_id, 10);
    if (isNaN(prodId)) {
      return res.status(400).json({ error: 'producto_id es obligatorio' });
    }
    const resultado = await reponerProductoIndividual(prodId, incremento ? parseInt(incremento, 10) : 20);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
