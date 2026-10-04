import type { Cafeteria, Pedido, ResumenSimulacionSesion, ProductoVendidoResumen } from '../types';

/**
 * Compila y consolida las métricas de la sesión de simulación para el reporte y exportación.
 */
export function construirResumenSesion(
  cafeteria: Cafeteria | undefined,
  intervaloSegundos: number,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  pedidos: Pedido[]
): ResumenSimulacionSesion {
  const inicioDate = fechaInicio || new Date();
  const finDate = fechaFin || new Date();
  const duracionSegundos = Math.max(0, Math.round((finDate.getTime() - inicioDate.getTime()) / 1000));

  const totalPedidos = pedidos.length;
  const totalVentas = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const ticketPromedio = totalPedidos > 0 ? Math.round(totalVentas / totalPedidos) : 0;

  let totalUnidades = 0;
  const productMap = new Map<string, { cantidad: number; precioUnitario: number; subtotal: number }>();
  const porEstado: {
    pendiente: number;
    preparando: number;
    listo: number;
    entregado: number;
    [key: string]: number;
  } = {
    pendiente: 0,
    preparando: 0,
    listo: 0,
    entregado: 0,
  };
  const porMetodoPago: Record<string, number> = {};

  for (const pedido of pedidos) {
    // Conteo por estado
    const est = (pedido.estado || 'pendiente').toLowerCase();
    porEstado[est] = (porEstado[est] || 0) + 1;

    // Conteo por método de pago
    const mp = pedido.metodo_pago || 'Webpay Plus';
    porMetodoPago[mp] = (porMetodoPago[mp] || 0) + 1;

    // Conteo de ítems y productos
    if (pedido.items && Array.isArray(pedido.items)) {
      for (const it of pedido.items) {
        const qty = Number(it.cantidad) || 1;
        const price = Number(it.precio_unitario) || 0;
        const sub = Number(it.subtotal) || price * qty;
        totalUnidades += qty;

        const prev = productMap.get(it.nombre) || { cantidad: 0, precioUnitario: price, subtotal: 0 };
        productMap.set(it.nombre, {
          cantidad: prev.cantidad + qty,
          precioUnitario: price,
          subtotal: prev.subtotal + sub,
        });
      }
    } else {
      totalUnidades += 1;
    }
  }

  const productosMasVendidos: ProductoVendidoResumen[] = Array.from(productMap.entries())
    .map(([nombre, data]) => ({
      nombre,
      cantidad: data.cantidad,
      precioUnitario: data.precioUnitario,
      subtotal: data.subtotal,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    cafeteriaId: cafeteria ? Number(cafeteria.id) : 1,
    cafeteriaNombre: cafeteria?.nombre || 'Cafetería Central',
    sedeNombre: cafeteria?.nombre_sede || 'Campus Central',
    ciudad: cafeteria?.ciudad || 'Temuco',
    intervaloSegundos,
    fechaInicio: inicioDate.toISOString(),
    fechaFin: finDate.toISOString(),
    duracionSegundos,
    totalPedidos,
    totalVentas,
    totalUnidades,
    ticketPromedio,
    porEstado,
    porMetodoPago,
    productosMasVendidos,
    pedidos,
  };
}

/**
 * Formatea valores de dinero a formato peso chileno
 */
export function formatearMoneda(monto: number): string {
  return `$${monto.toLocaleString('es-CL')}`;
}

/**
 * Formatea fechas a string legible local
 */
export function formatearFecha(isoString: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Genera el contenido CSV compatible con Excel (UTF-8 con BOM)
 */
export function generarCsvSimulacion(resumen: ResumenSimulacionSesion): string {
  const lineas: string[] = [];

  // Metadatos iniciales
  lineas.push('# ==============================================================');
  lineas.push('# COFFEEFASTER - REPORTE DE DATOS SIMULADOS');
  lineas.push(`# Cafeteria: ${resumen.cafeteriaNombre} (${resumen.sedeNombre} - ${resumen.ciudad})`);
  lineas.push(`# Fecha de Ejecución: ${formatearFecha(resumen.fechaInicio)} a ${formatearFecha(resumen.fechaFin)}`);
  lineas.push(`# Frecuencia de Inserción: Cada ${resumen.intervaloSegundos} segundos`);
  lineas.push(`# Total Pedidos Generados: ${resumen.totalPedidos}`);
  lineas.push(`# Total Facturado: CLP ${resumen.totalVentas}`);
  lineas.push(`# Total Unidades Vendidas: ${resumen.totalUnidades}`);
  lineas.push('# ==============================================================');
  lineas.push('');

  // Encabezados de columnas (separados por punto y coma para Excel en español)
  const headers = [
    'ID Pedido',
    'Codigo Retiro',
    'Fecha Creacion',
    'Cliente',
    'Items Comprados',
    'Total Unidades',
    'Total Pedido CLP',
    'Metodo de Pago',
    'Estado Final',
    'Pago Estado',
  ];
  lineas.push(headers.join(';'));

  // Filas de pedidos
  for (const ped of resumen.pedidos) {
    const itemsDetalle = ped.items && ped.items.length > 0
      ? ped.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(' + ')
      : '1x Compra de cafetería';

    const cantArticulos = ped.items && ped.items.length > 0
      ? ped.items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0)
      : 1;

    const fila = [
      ped.id,
      `"${ped.codigo_retiro_diario || ''}"`,
      `"${formatearFecha(ped.creado_en)}"`,
      `"${(ped.cliente || ped.usuario_nombre || 'Estudiante').replace(/"/g, '""')}"`,
      `"${itemsDetalle.replace(/"/g, '""')}"`,
      cantArticulos,
      Number(ped.total) || 0,
      `"${(ped.metodo_pago || 'Webpay').replace(/"/g, '""')}"`,
      `"${(ped.estado || 'pendiente').toUpperCase()}"`,
      `"${(ped.pago_estado || 'pagado').toUpperCase()}"`,
    ];
    lineas.push(fila.join(';'));
  }

  return lineas.join('\r\n');
}

/**
 * Descarga el archivo CSV en el navegador del usuario
 */
export function descargarArchivoCsv(resumen: ResumenSimulacionSesion): void {
  const contenido = generarCsvSimulacion(resumen);
  // Agregar BOM (\uFEFF) para que Excel interprete tildes y caracteres UTF-8 correctamente
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `reporte_simulacion_cafeteria_${resumen.cafeteriaId}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga el archivo JSON completo de la simulación
 */
export function descargarArchivoJson(resumen: ResumenSimulacionSesion): void {
  const jsonStr = JSON.stringify(resumen, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `datos_simulados_cafeteria_${resumen.cafeteriaId}_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera el documento HTML completo y profesional con estilos para pantalla e impresión A4/PDF
 */
export function generarHtmlDocumentoReporte(resumen: ResumenSimulacionSesion): string {
  const formatearM = (n: number) => `$${n.toLocaleString('es-CL')}`;

  const filasProductos = resumen.productosMasVendidos.map((p, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="font-weight: 600; color: #1e293b;">${p.nombre}</td>
      <td style="text-align: center; font-weight: 700;">${p.cantidad} u.</td>
      <td style="text-align: right;">${formatearM(p.precioUnitario)}</td>
      <td style="text-align: right; font-weight: 700; color: #047857;">${formatearM(p.subtotal)}</td>
    </tr>
  `).join('');

  const filasPedidos = resumen.pedidos.map((ped) => {
    const itemsStr = ped.items && ped.items.length > 0
      ? ped.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')
      : '1x Compra de cafetería';

    let estadoClase = 'badge-pendiente';
    let estadoLabel = '⏳ PENDIENTE';
    const est = (ped.estado || 'pendiente').toLowerCase();
    if (est === 'preparando') {
      estadoClase = 'badge-preparando';
      estadoLabel = '🍳 EN PREP.';
    } else if (est === 'listo') {
      estadoClase = 'badge-listo';
      estadoLabel = '🔔 LISTO';
    } else if (est === 'entregado') {
      estadoClase = 'badge-entregado';
      estadoLabel = '✅ ENTREGADO';
    }

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: #4338ca;">#${ped.id}</td>
        <td style="font-family: monospace; font-weight: 600;">${ped.codigo_retiro_diario || '—'}</td>
        <td style="font-size: 0.8rem; color: #475569;">${formatearFecha(ped.creado_en)}</td>
        <td style="font-weight: 500;">${ped.cliente || ped.usuario_nombre || 'Estudiante'}</td>
        <td style="font-size: 0.85rem; color: #334155;">${itemsStr}</td>
        <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatearM(Number(ped.total) || 0)}</td>
        <td style="font-size: 0.8rem; color: #475569;">${ped.metodo_pago || 'Webpay'}</td>
        <td style="text-align: center;"><span class="badge ${estadoClase}">${estadoLabel}</span></td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Datos Simulados - ${resumen.cafeteriaNombre}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
    }
    .report-paper {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #4a2e18;
      padding-bottom: 1.5rem;
      margin-bottom: 1.75rem;
    }
    .brand-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #4a2e18;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brand-sub {
      font-size: 0.85rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .meta-box {
      text-align: right;
      font-size: 0.82rem;
      color: #475569;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 1.5rem 0 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }
    .kpi-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .kpi-value {
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 0.72rem;
      color: #94a3b8;
      margin-top: 0.15rem;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .table-custom th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 0.65rem 0.85rem;
      border-bottom: 2px solid #cbd5e1;
    }
    .table-custom td {
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-custom tr:nth-child(even) td {
      background: #fafafa;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .badge-pendiente { background: #fef3c7; color: #92400e; }
    .badge-preparando { background: #dbeafe; color: #1e40af; }
    .badge-listo { background: #ccfbf1; color: #0f766e; }
    .badge-entregado { background: #dcfce7; color: #166534; }
    
    .status-summary-bar {
      display: flex;
      gap: 1rem;
      background: #f1f5f9;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .status-summary-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .report-footer {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .no-print-toolbar {
      max-width: 900px;
      margin: 0 auto 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .btn-print {
      background: #4a2e18;
      color: #ffffff;
      border: none;
      font-weight: 700;
      padding: 0.55rem 1.15rem;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-print:hover {
      background: #331f0f;
    }
    
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .report-paper {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .table-custom th {
        background: #e2e8f0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div style="font-size: 0.9rem; font-weight: 600; color: #334155;">
      📄 Documento de Datos Simulados • <strong>${resumen.totalPedidos} pedidos</strong> generados
    </div>
    <button class="btn-print" onclick="window.print()">
      <span>🖨️</span>
      <span>Imprimir / Guardar como PDF</span>
    </button>
  </div>

  <div class="report-paper">
    <header class="report-header">
      <div>
        <h1 class="brand-title">☕ CoffeeFaster</h1>
        <p class="brand-sub">Sistema de Gestión de Cafeterías Universitarias • Reporte de Simulación de Carga</p>
        <p style="margin-top: 0.35rem; font-size: 0.85rem; color: #475569;">
          📍 <strong>${resumen.cafeteriaNombre}</strong> (${resumen.sedeNombre}, ${resumen.ciudad})
        </p>
      </div>
      <div class="meta-box">
        <div><strong>Generado:</strong> ${formatearFecha(resumen.fechaFin)}</div>
        <div><strong>Frecuencia:</strong> 1 pedido cada ${resumen.intervaloSegundos}s</div>
        <div><strong>Duración:</strong> ${resumen.duracionSegundos} segundos (${(resumen.duracionSegundos / 60).toFixed(1)} min)</div>
      </div>
    </header>

    <!-- Resumen de Métricas Clave -->
    <section>
      <h2 class="section-title">📊 Resumen Ejecutivo de la Simulación</h2>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Pedidos Simulados</div>
          <div class="kpi-value">${resumen.totalPedidos}</div>
          <div class="kpi-sub">Total de transacciones</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Facturado</div>
          <div class="kpi-value" style="color: #047857;">${formatearM(resumen.totalVentas)}</div>
          <div class="kpi-sub">Ventas simuladas (CLP)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Unidades Vendidas</div>
          <div class="kpi-value" style="color: #2563eb;">${resumen.totalUnidades} u.</div>
          <div class="kpi-sub">Consumo de inventario</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ticket Promedio</div>
          <div class="kpi-value" style="color: #b45309;">${formatearM(resumen.ticketPromedio)}</div>
          <div class="kpi-sub">Por orden de compra</div>
        </div>
      </div>

      <!-- Resumen por Estados de Atención -->
      <div class="status-summary-bar">
        <div class="status-summary-item">
          <span>⏳ Pendientes:</span>
          <strong>${resumen.porEstado.pendiente || 0}</strong>
        </div>
        <div class="status-summary-item">
          <span>🍳 En Preparación:</span>
          <strong>${resumen.porEstado.preparando || 0}</strong>
        </div>
        <div class="status-summary-item">
          <span>🔔 Listos para retiro:</span>
          <strong>${resumen.porEstado.listo || 0}</strong>
        </div>
        <div class="status-summary-item">
          <span>✅ Entregados:</span>
          <strong style="color: #047857;">${resumen.porEstado.entregado || 0}</strong>
        </div>
      </div>
    </section>

    <!-- Desglose de Productos Vendidos -->
    <section>
      <h2 class="section-title">📦 Desglose de Productos Despachados</h2>
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Producto</th>
            <th style="width: 110px; text-align: center;">Unidades</th>
            <th style="width: 120px; text-align: right;">P. Unitario</th>
            <th style="width: 130px; text-align: right;">Total CLP</th>
          </tr>
        </thead>
        <tbody>
          ${filasProductos || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No hay productos registrados en esta simulación.</td></tr>'}
        </tbody>
      </table>
    </section>

    <!-- Tabla Detallada de Todos los Pedidos Simulados -->
    <section>
      <h2 class="section-title">📋 Registro Detallado de Pedidos Simulados (${resumen.totalPedidos})</h2>
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 70px;">Pedido</th>
            <th style="width: 90px;">Código</th>
            <th style="width: 125px;">Fecha / Hora</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th style="width: 95px; text-align: right;">Total</th>
            <th style="width: 90px;">Pago</th>
            <th style="width: 100px; text-align: center;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filasPedidos || '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No se registraron pedidos en esta sesión.</td></tr>'}
        </tbody>
      </table>
    </section>

    <footer class="report-footer">
      <div>CoffeeFaster • Simulador de Transacciones y Datos de Carga en Tiempo Real</div>
      <div>Base de datos: PostgreSQL • Auditoría de Simulación</div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Abre la ventana de impresión/guardado a PDF
 */
export function abrirVentanaImpresionPdf(resumen: ResumenSimulacionSesion): void {
  const html = generarHtmlDocumentoReporte(resumen);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Dar un breve tiempo para renderizar CSS antes del print
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}

/**
 * Descarga el documento HTML como archivo
 */
export function descargarArchivoHtml(resumen: ResumenSimulacionSesion): void {
  const html = generarHtmlDocumentoReporte(resumen);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `reporte_simulacion_cafeteria_${resumen.cafeteriaId}_${timestamp}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
