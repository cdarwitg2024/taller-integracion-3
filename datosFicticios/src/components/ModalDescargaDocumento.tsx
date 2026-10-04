import React, { useState } from 'react';
import type { ResumenSimulacionSesion } from '../types';
import {
  descargarArchivoCsv,
  descargarArchivoJson,
  descargarArchivoHtml,
  abrirVentanaImpresionPdf,
  formatearFecha,
  formatearMoneda,
} from '../utils/documentGenerator';

interface ModalDescargaDocumentoProps {
  isOpen: boolean;
  onClose: () => void;
  resumen: ResumenSimulacionSesion;
  onReanudarSimulacion?: () => void;
  onReiniciarSesion?: () => void;
  razonParada?: 'usuario' | 'stock' | 'manual';
}

export const ModalDescargaDocumento: React.FC<ModalDescargaDocumentoProps> = ({
  isOpen,
  onClose,
  resumen,
  onReanudarSimulacion,
  onReiniciarSesion,
  razonParada = 'usuario',
}) => {
  const [tabActiva, setTabActiva] = useState<'documento' | 'tabla' | 'csv'>('documento');
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('');

  if (!isOpen) return null;

  const pedidosFiltrados = resumen.pedidos.filter((p) => {
    if (!filtroBusqueda) return true;
    const q = filtroBusqueda.toLowerCase();
    const cliente = (p.cliente || p.usuario_nombre || '').toLowerCase();
    const codigo = (p.codigo_retiro_diario || '').toLowerCase();
    const id = String(p.id);
    const estado = (p.estado || '').toLowerCase();
    return cliente.includes(q) || codigo.includes(q) || id.includes(q) || estado.includes(q);
  });

  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="doc-modal-header">
          <div className="doc-modal-header-left">
            <span className="doc-modal-badge">
              {razonParada === 'stock' ? '⚠️ SIN STOCK DISPONIBLE' : '⏹️ GENERACIÓN DETENIDA'}
            </span>
            <h2 className="doc-modal-title">Descargar Documento de Datos Simulados</h2>
            <p className="doc-modal-sub">
              Cafetería: <strong>{resumen.cafeteriaNombre}</strong> ({resumen.sedeNombre}) •{' '}
              {resumen.totalPedidos} compras simuladas
            </p>
          </div>
          <button type="button" className="doc-modal-close" onClick={onClose} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* Notificación informativa del estado */}
        <div className="doc-modal-banner">
          <div className="doc-modal-banner-icon">
            {razonParada === 'stock' ? '📦' : '📄'}
          </div>
          <div className="doc-modal-banner-text">
            <strong>
              {razonParada === 'stock'
                ? 'La generación automática se detuvo debido a que los productos se quedaron sin stock.'
                : 'La generación de datos se encuentra pausada/detenida.'}
            </strong>
            <p>
              Puedes descargar de inmediato el documento oficial que recopila todos los pedidos simulados para tus
              gráficos y análisis.
            </p>
          </div>
        </div>

        {/* Resumen rápido de métricas (KPIs de la Sesión) */}
        <div className="doc-summary-strip">
          <div className="doc-summary-card">
            <span className="doc-summary-label">Pedidos Simulados</span>
            <strong className="doc-summary-val">{resumen.totalPedidos}</strong>
            <span className="doc-summary-desc">Transacciones</span>
          </div>

          <div className="doc-summary-card">
            <span className="doc-summary-label">Ventas Totales</span>
            <strong className="doc-summary-val text-green">{formatearMoneda(resumen.totalVentas)}</strong>
            <span className="doc-summary-desc">CLP facturados</span>
          </div>

          <div className="doc-summary-card">
            <span className="doc-summary-label">Unidades Despachadas</span>
            <strong className="doc-summary-val text-blue">{resumen.totalUnidades} u.</strong>
            <span className="doc-summary-desc">Items vendidos</span>
          </div>

          <div className="doc-summary-card">
            <span className="doc-summary-label">Ticket Promedio</span>
            <strong className="doc-summary-val">{formatearMoneda(resumen.ticketPromedio)}</strong>
            <span className="doc-summary-desc">Por pedido</span>
          </div>

          <div className="doc-summary-card">
            <span className="doc-summary-label">Tiempo Transcurrido</span>
            <strong className="doc-summary-val text-brown">
              {resumen.duracionSegundos >= 60
                ? `${Math.floor(resumen.duracionSegundos / 60)}m ${resumen.duracionSegundos % 60}s`
                : `${resumen.duracionSegundos}s`}
            </strong>
            <span className="doc-summary-desc">Cada {resumen.intervaloSegundos}s</span>
          </div>
        </div>

        {/* Barra de Acciones de Descarga Principal */}
        <div className="doc-download-actions-grid">
          <button
            type="button"
            className="btn-download-hero btn-pdf"
            onClick={() => abrirVentanaImpresionPdf(resumen)}
          >
            <span className="btn-dl-icon">🖨️</span>
            <div className="btn-dl-info">
              <span className="btn-dl-title">Imprimir / Guardar como PDF</span>
              <span className="btn-dl-sub">Documento oficial formateado en A4 listo para PDF</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-download-hero btn-csv"
            onClick={() => descargarArchivoCsv(resumen)}
          >
            <span className="btn-dl-icon">📊</span>
            <div className="btn-dl-info">
              <span className="btn-dl-title">Descargar Planilla Excel (CSV)</span>
              <span className="btn-dl-sub">Formato compatible con Microsoft Excel y Google Sheets</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-download-hero btn-json"
            onClick={() => descargarArchivoJson(resumen)}
          >
            <span className="btn-dl-icon">💾</span>
            <div className="btn-dl-info">
              <span className="btn-dl-title">Descargar Archivo JSON</span>
              <span className="btn-dl-sub">Estructura completa de datos para integración o auditoría</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-download-hero btn-html"
            onClick={() => descargarArchivoHtml(resumen)}
          >
            <span className="btn-dl-icon">🌐</span>
            <div className="btn-dl-info">
              <span className="btn-dl-title">Descargar Reporte HTML</span>
              <span className="btn-dl-sub">Página web autónoma para ver y compartir sin conexión</span>
            </div>
          </button>
        </div>

        {/* Pestañas de Vista Previa */}
        <div className="doc-preview-tabs-bar">
          <div className="doc-preview-tabs-left">
            <button
              type="button"
              className={`doc-tab-btn ${tabActiva === 'documento' ? 'active' : ''}`}
              onClick={() => setTabActiva('documento')}
            >
              📄 Vista Previa del Documento
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${tabActiva === 'tabla' ? 'active' : ''}`}
              onClick={() => setTabActiva('tabla')}
            >
              📋 Tabla de Pedidos ({resumen.pedidos.length})
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${tabActiva === 'csv' ? 'active' : ''}`}
              onClick={() => setTabActiva('csv')}
            >
              📑 Vista Previa CSV
            </button>
          </div>

          {tabActiva === 'tabla' && (
            <div className="doc-tab-search">
              <input
                type="text"
                placeholder="Buscar por cliente, ID, código o estado..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                className="doc-search-input"
              />
            </div>
          )}
        </div>

        {/* Contenido de la Vista Previa */}
        <div className="doc-preview-content-area">
          {tabActiva === 'documento' && (
            <div className="preview-paper-sheet">
              <div className="sheet-header">
                <div>
                  <h3 className="sheet-brand">☕ CoffeeFaster</h3>
                  <p className="sheet-subtitle">Reporte de Auditoría y Simulación de Carga Transaccional</p>
                  <p className="sheet-loc">
                    Cafetería: <strong>{resumen.cafeteriaNombre}</strong> • {resumen.sedeNombre} ({resumen.ciudad})
                  </p>
                </div>
                <div className="sheet-meta">
                  <div><strong>Inicio:</strong> {formatearFecha(resumen.fechaInicio)}</div>
                  <div><strong>Término:</strong> {formatearFecha(resumen.fechaFin)}</div>
                  <div><strong>Frecuencia:</strong> Cada {resumen.intervaloSegundos}s</div>
                </div>
              </div>

              {/* Estados de pedidos */}
              <div className="sheet-states-bar">
                <span className="sheet-state-pill pill-pendiente">
                  ⏳ Pendientes: <strong>{resumen.porEstado.pendiente || 0}</strong>
                </span>
                <span className="sheet-state-pill pill-preparando">
                  🍳 En Preparación: <strong>{resumen.porEstado.preparando || 0}</strong>
                </span>
                <span className="sheet-state-pill pill-listo">
                  🔔 Listos: <strong>{resumen.porEstado.listo || 0}</strong>
                </span>
                <span className="sheet-state-pill pill-entregado">
                  ✅ Entregados: <strong>{resumen.porEstado.entregado || 0}</strong>
                </span>
              </div>

              {/* Ranking de Productos Más Vendidos */}
              <h4 className="sheet-section-title">📦 Resumen de Productos Vendidos</h4>
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th>Producto</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Unidades</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Total Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.productosMasVendidos.map((prod, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{prod.cantidad} u.</td>
                      <td style={{ textAlign: 'right' }}>{formatearMoneda(prod.precioUnitario)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        {formatearMoneda(prod.subtotal)}
                      </td>
                    </tr>
                  ))}
                  {resumen.productosMasVendidos.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        No hay productos registrados en esta simulación.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Listado de Pedidos */}
              <h4 className="sheet-section-title">📋 Listado de Pedidos Simulados ({resumen.pedidos.length})</h4>
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '65px' }}>ID</th>
                    <th style={{ width: '85px' }}>Código</th>
                    <th style={{ width: '110px' }}>Hora</th>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '85px' }}>Pago</th>
                    <th style={{ width: '95px', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.pedidos.map((ped) => {
                    const itemsStr =
                      ped.items && ped.items.length > 0
                        ? ped.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')
                        : '1x Compra';

                    const est = (ped.estado || 'pendiente').toLowerCase();
                    return (
                      <tr key={ped.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4338ca' }}>
                          #{ped.id}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {ped.codigo_retiro_diario || '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                          {formatearFecha(ped.creado_en)}
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {ped.cliente || ped.usuario_nombre || 'Estudiante'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#334155' }}>{itemsStr}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {formatearMoneda(Number(ped.total) || 0)}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                          {ped.metodo_pago || 'Webpay'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`sheet-badge badge-${est}`}>{est.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tabActiva === 'tabla' && (
            <div className="preview-table-container">
              <table className="interactive-preview-table">
                <thead>
                  <tr>
                    <th># Pedido</th>
                    <th>Código Retiro</th>
                    <th>Fecha / Hora</th>
                    <th>Cliente</th>
                    <th>Productos Detallados</th>
                    <th style={{ textAlign: 'right' }}>Monto CLP</th>
                    <th>Método de Pago</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((ped) => {
                    const itemsStr =
                      ped.items && ped.items.length > 0
                        ? ped.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')
                        : '1x Compra';
                    const est = (ped.estado || 'pendiente').toLowerCase();
                    return (
                      <tr key={ped.id}>
                        <td className="bold-mono">#{ped.id}</td>
                        <td className="code-cell">{ped.codigo_retiro_diario || '—'}</td>
                        <td className="date-cell">{formatearFecha(ped.creado_en)}</td>
                        <td className="buyer-cell">
                          👤 {ped.cliente || ped.usuario_nombre || 'Estudiante'}
                        </td>
                        <td className="items-cell">{itemsStr}</td>
                        <td className="price-cell">{formatearMoneda(Number(ped.total) || 0)}</td>
                        <td className="payment-cell">💳 {ped.metodo_pago || 'Webpay'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`sheet-badge badge-${est}`}>{est.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {pedidosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        No se encontraron pedidos con el criterio de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tabActiva === 'csv' && (
            <div className="preview-raw-csv">
              <pre>{resumen.pedidos.length > 0 ? (
                `ID;Codigo;Fecha;Cliente;Productos;Unidades;Total_CLP;Metodo_Pago;Estado\n` +
                resumen.pedidos
                  .map((p) => {
                    const itemsStr = p.items ? p.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(' + ') : '1x Compra';
                    const units = p.items ? p.items.reduce((s, i) => s + i.cantidad, 0) : 1;
                    return `${p.id};"${p.codigo_retiro_diario}";"${formatearFecha(p.creado_en)}";"${p.cliente || 'Estudiante'}";"${itemsStr}";${units};${p.total};"${p.metodo_pago}";"${p.estado}"`;
                  })
                  .join('\n')
              ) : (
                'No hay pedidos disponibles para exportar.'
              )}</pre>
            </div>
          )}
        </div>

        {/* Pie del modal con acciones */}
        <div className="doc-modal-footer">
          <div className="doc-modal-footer-left">
            {onReiniciarSesion && (
              <button
                type="button"
                className="btn-modal-aux btn-reset-session"
                onClick={() => {
                  if (window.confirm('¿Deseas reiniciar la sesión actual de simulación? Se limpiarán los datos acumulados para comenzar de cero.')) {
                    onReiniciarSesion();
                    onClose();
                  }
                }}
              >
                🗑️ Limpiar / Nueva Sesión
              </button>
            )}
          </div>

          <div className="doc-modal-footer-right">
            <button type="button" className="btn-modal-secondary" onClick={onClose}>
              Cerrar Vista
            </button>

            {onReanudarSimulacion && (
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  onClose();
                  onReanudarSimulacion();
                }}
              >
                ▶ Reanudar Simulación
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalDescargaDocumento;
