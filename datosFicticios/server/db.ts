import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables desde el .env del proyecto principal (o local si existe)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '54322', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 4000,
});

// Manejo de errores en el pool
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

export async function getDbStatus() {
  const start = Date.now();
  const res = await pool.query('SELECT current_database() as db, current_user as user, version() as version, NOW() as now');
  const latency = Date.now() - start;
  return {
    ok: true,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '54322', 10),
    database: res.rows[0]?.db || process.env.DB_NAME || 'postgres',
    user: res.rows[0]?.user || process.env.DB_USER || 'postgres',
    timestamp: res.rows[0]?.now,
    latencyMs: latency,
  };
}

export async function getCafeterias() {
  const res = await pool.query(`
    SELECT 
      c.id, 
      c.nombre, 
      c.descripcion, 
      c.hora_apertura, 
      c.hora_cierre, 
      c.telefono,
      c.imagen_url, 
      c.activa,
      s.nombre_sede, 
      s.ciudad
    FROM cafeterias c
    LEFT JOIN campus_sedes s ON c.campus_id = s.id
    WHERE c.activa = true
    ORDER BY c.id ASC
  `);
  return res.rows;
}

export async function getProductos(cafeteriaId: number) {
  const res = await pool.query(`
    SELECT 
      p.id, 
      p.cafeteria_id, 
      p.categoria_id, 
      p.nombre, 
      p.descripcion, 
      p.precio, 
      p.stock, 
      p.stock_minimo, 
      p.imagen_url, 
      p.activo,
      c.nombre as categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.cafeteria_id = $1 AND p.activo = true
    ORDER BY p.id ASC
  `, [cafeteriaId]);
  return res.rows;
}

export async function getEstadisticas(cafeteriaId: number) {
  const pedidosRes = await pool.query(`
    SELECT 
      COUNT(*) as total_pedidos,
      COALESCE(SUM(total), 0) as total_ventas,
      COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados,
      COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
      COUNT(CASE WHEN estado = 'preparando' THEN 1 END) as preparando,
      COUNT(CASE WHEN estado = 'listo' THEN 1 END) as listos
    FROM pedidos
    WHERE cafeteria_id = $1
  `, [cafeteriaId]);

  const stockRes = await pool.query(`
    SELECT 
      COUNT(*) as total_productos,
      COUNT(CASE WHEN stock <= 0 THEN 1 END) as sin_stock,
      COUNT(CASE WHEN stock > 0 AND stock <= stock_minimo THEN 1 END) as stock_critico,
      COUNT(CASE WHEN stock > stock_minimo THEN 1 END) as stock_optimo,
      COALESCE(SUM(stock), 0) as total_unidades
    FROM productos
    WHERE cafeteria_id = $1 AND activo = true
  `, [cafeteriaId]);

  return {
    pedidos: pedidosRes.rows[0],
    stock: stockRes.rows[0],
  };
}

export interface ProcesoCafeteriaInfo {
  pedidoId: number;
  codigoRetiro: string;
  cafeteriaId: number;
  cliente: string;
  total: number;
  itemsResumen: string;
  estadoActual: 'pendiente' | 'preparando' | 'listo' | 'entregado';
  siguienteEstado: 'preparando' | 'listo' | 'entregado' | null;
  demoraActualSegundos: number;
  cambioEstimadoEn: number;
  segundosRestantes: number;
  iniciadoEn: number;
  completadoEn?: number;
}

// Estructuras en memoria para seguimiento en vivo del ciclo de vida de la cafetería
const procesosActivos = new Map<number, { timer: NodeJS.Timeout; data: ProcesoCafeteriaInfo }>();
const procesosHistorial: ProcesoCafeteriaInfo[] = [];

export async function actualizarEstadoPedido(pedidoId: number, nuevoEstado: string) {
  try {
    if (nuevoEstado === 'preparando') {
      await pool.query(
        'UPDATE pedidos SET estado = $1, inicio_preparacion_en = NOW() WHERE id = $2',
        [nuevoEstado, pedidoId]
      );
    } else if (nuevoEstado === 'listo') {
      await pool.query(
        `UPDATE pedidos 
         SET estado = $1, 
             listo_en = NOW(), 
             tiempo_real_min = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - creado_en)) / 60)::INTEGER) 
         WHERE id = $2`,
        [nuevoEstado, pedidoId]
      );
    } else if (nuevoEstado === 'entregado') {
      await pool.query(
        'UPDATE pedidos SET estado = $1, entregado_en = NOW(), qr_usado = true WHERE id = $2',
        [nuevoEstado, pedidoId]
      );
    } else {
      await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [nuevoEstado, pedidoId]);
    }
    return true;
  } catch (err: any) {
    console.error(`Error al actualizar pedido #${pedidoId} a ${nuevoEstado}:`, err.message);
    return false;
  }
}

export function iniciarProcesoCafeteria(
  pedidoId: number,
  cafeteriaId: number,
  codigoRetiro: string,
  cliente: string,
  total: number,
  items: any[],
  delayMin = 1,
  delayMax = 10
) {
  if (procesosActivos.has(pedidoId)) {
    const prev = procesosActivos.get(pedidoId);
    if (prev?.timer) clearTimeout(prev.timer);
    procesosActivos.delete(pedidoId);
  }

  const getRandomDelay = () => Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

  const itemsResumen = items && items.length > 0
    ? items.map((it: any) => `${it.cantidad}x ${it.nombre}`).join(', ')
    : '1x Compra de cafetería';

  const delay1 = getRandomDelay();
  const proceso: ProcesoCafeteriaInfo = {
    pedidoId,
    codigoRetiro,
    cafeteriaId,
    cliente,
    total,
    itemsResumen,
    estadoActual: 'pendiente',
    siguienteEstado: 'preparando',
    demoraActualSegundos: delay1,
    cambioEstimadoEn: Date.now() + delay1 * 1000,
    segundosRestantes: delay1,
    iniciadoEn: Date.now(),
  };

  const scheduleNext = (
    _actual: 'pendiente' | 'preparando' | 'listo',
    siguiente: 'preparando' | 'listo' | 'entregado',
    delaySec: number
  ) => {
    const timer = setTimeout(async () => {
      await actualizarEstadoPedido(pedidoId, siguiente);

      if (siguiente === 'entregado') {
        proceso.estadoActual = 'entregado';
        proceso.siguienteEstado = null;
        proceso.demoraActualSegundos = 0;
        proceso.segundosRestantes = 0;
        proceso.completadoEn = Date.now();
        procesosActivos.delete(pedidoId);
        procesosHistorial.unshift({ ...proceso });
        if (procesosHistorial.length > 30) procesosHistorial.pop();
      } else {
        const nextTarget: 'listo' | 'entregado' = siguiente === 'preparando' ? 'listo' : 'entregado';
        const nextDelay = getRandomDelay();
        proceso.estadoActual = siguiente;
        proceso.siguienteEstado = nextTarget;
        proceso.demoraActualSegundos = nextDelay;
        proceso.cambioEstimadoEn = Date.now() + nextDelay * 1000;
        proceso.segundosRestantes = nextDelay;

        scheduleNext(siguiente, nextTarget, nextDelay);
      }
    }, delaySec * 1000);

    procesosActivos.set(pedidoId, { timer, data: proceso });
  };

  scheduleNext('pendiente', 'preparando', delay1);
}

export function getProcesosCafeteria(cafeteriaId?: number) {
  const now = Date.now();
  const activos: ProcesoCafeteriaInfo[] = [];

  for (const [, entry] of procesosActivos.entries()) {
    if (!cafeteriaId || entry.data.cafeteriaId === cafeteriaId) {
      const rest = Math.max(0, Math.ceil((entry.data.cambioEstimadoEn - now) / 1000));
      activos.push({
        ...entry.data,
        segundosRestantes: rest,
      });
    }
  }

  // Ordenar por inicio más reciente
  activos.sort((a, b) => b.iniciadoEn - a.iniciadoEn);

  const completados = cafeteriaId
    ? procesosHistorial.filter((p) => p.cafeteriaId === cafeteriaId).slice(0, 10)
    : procesosHistorial.slice(0, 10);

  return {
    activos,
    completados,
  };
}

export async function avanzarPasoProceso(pedidoId: number) {
  const entry = procesosActivos.get(pedidoId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  const siguiente = entry.data.siguienteEstado;
  if (!siguiente) return null;

  await actualizarEstadoPedido(pedidoId, siguiente);

  if (siguiente === 'entregado') {
    entry.data.estadoActual = 'entregado';
    entry.data.siguienteEstado = null;
    entry.data.completadoEn = Date.now();
    procesosActivos.delete(pedidoId);
    procesosHistorial.unshift({ ...entry.data });
    if (procesosHistorial.length > 30) procesosHistorial.pop();
    return entry.data;
  } else {
    const nextTarget: 'listo' | 'entregado' = siguiente === 'preparando' ? 'listo' : 'entregado';
    const nextDelay = Math.floor(Math.random() * 10) + 1;
    entry.data.estadoActual = siguiente;
    entry.data.siguienteEstado = nextTarget;
    entry.data.demoraActualSegundos = nextDelay;
    entry.data.cambioEstimadoEn = Date.now() + nextDelay * 1000;
    entry.data.segundosRestantes = nextDelay;

    const timer = setTimeout(async () => {
      await actualizarEstadoPedido(pedidoId, nextTarget);
      if (nextTarget === 'entregado') {
        entry.data.estadoActual = 'entregado';
        entry.data.siguienteEstado = null;
        entry.data.completadoEn = Date.now();
        procesosActivos.delete(pedidoId);
        procesosHistorial.unshift({ ...entry.data });
        if (procesosHistorial.length > 30) procesosHistorial.pop();
      }
    }, nextDelay * 1000);

    procesosActivos.set(pedidoId, { timer, data: entry.data });
    return entry.data;
  }
}

export async function getUltimosPedidos(cafeteriaId: number, limit = 15) {
  const res = await pool.query(`
    SELECT 
      p.id, 
      p.codigo_retiro_diario, 
      p.estado, 
      p.pago_estado, 
      p.total, 
      p.creado_en,
      p.inicio_preparacion_en,
      p.listo_en,
      p.entregado_en,
      p.tiempo_real_min,
      COALESCE(u.nombre || ' ' || COALESCE(u.apellido, ''), 'Cliente Universitario') as cliente_nombre,
      c.nombre as cafeteria_nombre,
      COALESCE(
        json_agg(
          json_build_object(
            'producto_id', dp.producto_id,
            'nombre', COALESCE(pr.nombre, 'Producto'),
            'cantidad', dp.cantidad,
            'precio_unitario', dp.precio_unitario,
            'subtotal', dp.subtotal
          )
        ) FILTER (WHERE dp.id IS NOT NULL), '[]'::json
      ) as items,
      COALESCE(mp.nombre, 'Webpay') as metodo_pago
    FROM pedidos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN cafeterias c ON p.cafeteria_id = c.id
    LEFT JOIN detalles_pedido dp ON dp.pedido_id = p.id
    LEFT JOIN productos pr ON dp.producto_id = pr.id
    LEFT JOIN pagos pg ON pg.pedido_id = p.id
    LEFT JOIN metodos_pago mp ON pg.metodo_pago_id = mp.id
    WHERE p.cafeteria_id = $1
    GROUP BY p.id, u.nombre, u.apellido, c.nombre, mp.nombre
    ORDER BY p.creado_en DESC
    LIMIT $2
  `, [cafeteriaId, limit]);
  return res.rows;
}

export async function simularCompra(
  cafeteriaId: number,
  opciones: {
    estado?: string;
    procesoCafeteria?: boolean;
    delayMin?: number;
    delayMax?: number;
  } = {}
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener productos disponibles con stock > 0
    const prodsRes = await client.query(`
      SELECT id, nombre, precio, stock, stock_minimo 
      FROM productos 
      WHERE cafeteria_id = $1 AND activo = true AND stock > 0
      ORDER BY RANDOM()
    `, [cafeteriaId]);

    if (prodsRes.rows.length === 0) {
      throw new Error('INVENTARIO_AGOTADO: No hay productos con stock disponible en esta cafetería. Por favor repon el inventario.');
    }

    // 2. Seleccionar entre 1 y 3 productos al azar
    const numItems = Math.min(Math.floor(Math.random() * 3) + 1, prodsRes.rows.length);
    const selectedProds = prodsRes.rows.slice(0, numItems);

    // 3. Obtener estudiantes disponibles para atribuir la compra
    const studentsRes = await client.query(`
      SELECT u.id, u.nombre, u.apellido 
      FROM usuarios u 
      JOIN roles r ON u.rol_id = r.id 
      WHERE r.nombre = 'estudiante'
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    const student = studentsRes.rows[0] || null;

    // 4. Obtener método de pago al azar
    const metodosRes = await client.query(`
      SELECT id, nombre, codigo 
      FROM metodos_pago 
      WHERE activo = true 
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    const metodo = metodosRes.rows[0] || { id: 1, nombre: 'Webpay Plus', codigo: 'WEBPAY' };

    // 5. Armar los detalles y calcular total
    const notasPosibles = ['Sin azúcar', 'Para llevar', 'Calentado', 'Sin hielo', 'Poco dulce', null, null];
    let totalPedido = 0;
    const itemsComprados: any[] = [];

    for (const prod of selectedProds) {
      const maxAvailable = Math.min(2, prod.stock);
      const cantidad = Math.max(1, Math.floor(Math.random() * maxAvailable) + 1);
      const precioUnitario = parseFloat(prod.precio);
      const subtotal = precioUnitario * cantidad;
      totalPedido += subtotal;

      const nota = notasPosibles[Math.floor(Math.random() * notasPosibles.length)];

      itemsComprados.push({
        producto_id: prod.id,
        nombre: prod.nombre,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal,
        nota,
        stock_restante: prod.stock - cantidad,
        stock_minimo: prod.stock_minimo,
      });
    }

    // 6. Generar código de retiro y QR token
    const randomSuffix = ['A', 'B', 'C', 'D', 'K', 'M', 'W'][Math.floor(Math.random() * 7)];
    const codigoRetiro = `${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`;
    const qrToken = `QR-${codigoRetiro}`;

    // Estado del pedido: Por defecto el proceso de cafetería inicia en 'pendiente'
    const activarProceso = opciones.procesoCafeteria !== false;
    const estadoInicial = activarProceso ? (opciones.estado || 'pendiente') : (opciones.estado || 'entregado');
    const pagoEstado = 'pagado';
    const esEntregadoDirecto = estadoInicial === 'entregado';
    const tiempoReal = esEntregadoDirecto ? Math.floor(Math.random() * 5) + 3 : null;

    // 7. Insertar pedido con columnas auditadas acordes a su estado inicial
    const insPedidoRes = await client.query(`
      INSERT INTO pedidos (
        usuario_id, 
        cafeteria_id, 
        codigo_retiro_diario, 
        estado, 
        pago_estado, 
        nota, 
        total, 
        qr_token, 
        qr_usado, 
        tiempo_estimado_min, 
        tiempo_real_min, 
        creado_en, 
        inicio_preparacion_en, 
        listo_en, 
        entregado_en
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        NOW(), 
        ${esEntregadoDirecto ? 'NOW()' : 'NULL'}, 
        ${esEntregadoDirecto ? 'NOW()' : 'NULL'}, 
        ${esEntregadoDirecto ? 'NOW()' : 'NULL'}
      ) RETURNING id, creado_en, codigo_retiro_diario, total
    `, [
      student?.id || null,
      cafeteriaId,
      codigoRetiro,
      estadoInicial,
      pagoEstado,
      'Compra simulada',
      totalPedido,
      qrToken,
      esEntregadoDirecto,
      5,
      tiempoReal
    ]);

    const nuevoPedido = insPedidoRes.rows[0];

    // 8. Insertar detalles del pedido, descontar stock y registrar movimientos
    const alertasGeneradas: any[] = [];

    for (const item of itemsComprados) {
      // Insert detalle
      await client.query(`
        INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nota)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [nuevoPedido.id, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal, item.nota]);

      // Descontar stock
      const updateProdRes = await client.query(`
        UPDATE productos
        SET stock = stock - $1, actualizado_en = NOW()
        WHERE id = $2
        RETURNING id, nombre, stock, stock_minimo
      `, [item.cantidad, item.producto_id]);

      const prodActualizado = updateProdRes.rows[0];

      // Registrar movimiento de inventario
      await client.query(`
        INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, motivo, creado_en)
        VALUES ($1, $2, 'salida', $3, $4, NOW())
      `, [item.producto_id, student?.id || null, item.cantidad, `Compra simulada Pedido #${nuevoPedido.id}`]);

      // Verificar alerta de stock bajo
      if (prodActualizado && prodActualizado.stock <= prodActualizado.stock_minimo) {
        alertasGeneradas.push({
          producto_id: prodActualizado.id,
          nombre: prodActualizado.nombre,
          stock_actual: prodActualizado.stock,
          stock_minimo: prodActualizado.stock_minimo,
        });

        // Insertar en tabla alertas_stock si no existe ya una alerta no leída
        await client.query(`
          INSERT INTO alertas_stock (cafeteria_id, producto_id, stock_actual, stock_minimo, mensaje, leida, creado_en)
          VALUES ($1, $2, $3, $4, $5, false, NOW())
        `, [
          cafeteriaId,
          prodActualizado.id,
          prodActualizado.stock,
          prodActualizado.stock_minimo,
          `Stock bajo en ${prodActualizado.nombre}: quedan ${prodActualizado.stock} unidades (mínimo: ${prodActualizado.stock_minimo})`
        ]);
      }
    }

    // 9. Registrar pago simulado
    const refPago = `SIM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    await client.query(`
      INSERT INTO pagos (pedido_id, metodo_pago_id, monto, estado, es_simulado, latencia_ms, referencia_transaccion, creado_en)
      VALUES ($1, $2, $3, 'aprobado', true, $4, $5, NOW())
    `, [nuevoPedido.id, metodo.id, totalPedido, Math.floor(100 + Math.random() * 200), refPago]);

    await client.query('COMMIT');

    const clienteNombre = student ? `${student.nombre} ${student.apellido || ''}`.trim() : 'Estudiante Anónimo';

    // Iniciar ciclo de vida si el proceso de cafetería está activo y arranca como 'pendiente'
    if (activarProceso && estadoInicial === 'pendiente') {
      const minD = Math.max(1, opciones.delayMin || 1);
      const maxD = Math.max(minD, opciones.delayMax || 10);
      iniciarProcesoCafeteria(
        nuevoPedido.id,
        cafeteriaId,
        nuevoPedido.codigo_retiro_diario,
        clienteNombre,
        totalPedido,
        itemsComprados,
        minD,
        maxD
      );
    }

    return {
      success: true,
      pedido: {
        id: nuevoPedido.id,
        codigo_retiro_diario: nuevoPedido.codigo_retiro_diario,
        total: totalPedido,
        creado_en: nuevoPedido.creado_en,
        estado: estadoInicial,
        pago_estado: pagoEstado,
        cliente: clienteNombre,
        metodo_pago: metodo.nombre,
        items: itemsComprados,
      },
      alertasStock: alertasGeneradas,
      procesoCafeteriaIniciado: activarProceso && estadoInicial === 'pendiente',
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reponerInventario(cafeteriaId: number, unidades = 30) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Reponer todos los productos activos de esta cafetería
    const updateRes = await client.query(`
      UPDATE productos
      SET stock = GREATEST(COALESCE(stock_minimo, 10) * 3, $2),
          actualizado_en = NOW()
      WHERE cafeteria_id = $1 AND activo = true
      RETURNING id, nombre, stock, stock_minimo
    `, [cafeteriaId, unidades]);

    const prods = updateRes.rows;

    // 2. Registrar movimiento de inventario para cada producto
    for (const prod of prods) {
      await client.query(`
        INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, creado_en)
        VALUES ($1, 'entrada', $2, 'Reposición masiva desde simulador', NOW())
      `, [prod.id, unidades]);
    }

    // 3. Marcar alertas de stock bajo anteriores como leídas
    await client.query(`
      UPDATE alertas_stock
      SET leida = true
      WHERE cafeteria_id = $1 AND leida = false
    `, [cafeteriaId]);

    await client.query('COMMIT');

    return {
      success: true,
      reabastecidos: prods.length,
      productos: prods,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reponerProductoIndividual(productoId: number, incremento = 20) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(`
      UPDATE productos
      SET stock = stock + $1, actualizado_en = NOW()
      WHERE id = $2
      RETURNING id, nombre, stock, stock_minimo, cafeteria_id
    `, [incremento, productoId]);

    const prod = updateRes.rows[0];
    if (!prod) throw new Error('Producto no encontrado');

    await client.query(`
      INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, creado_en)
      VALUES ($1, 'entrada', $2, 'Reposición puntual desde simulador', NOW())
    `, [prod.id, incremento]);

    // Marcar alertas para este producto como leídas
    await client.query(`
      UPDATE alertas_stock
      SET leida = true
      WHERE producto_id = $1 AND leida = false
    `, [prod.id]);

    await client.query('COMMIT');
    return { success: true, producto: prod };
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
