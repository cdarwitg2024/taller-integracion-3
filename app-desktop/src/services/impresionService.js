import { parsearFecha, formatearHora } from '../utils/dateUtils';
import { obtenerInfoCafeteria } from '../utils/cafeteriaInfo';

/**
 * Servicio de impresión y guardado de comandas y boletas.
 * Administra el ciclo de vida de impresión (primera impresión vs reimpresión en KDS),
 * renderizado térmico en iframe aislado (evitando congelamientos y hojas en blanco),
 * y el almacenamiento con selección de ubicación nativa (Electron / File System Access API).
 */

const STORAGE_PREFIX = 'kds_impresion_pedido_';

/**
 * Convierte un Blob en una cadena base64.
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatearMonto(monto) {
  return Number(monto || 0).toLocaleString('es-CL');
}

function getFechaYHora(fechaValor) {
  const d = fechaValor ? parsearFecha(fechaValor) || new Date() : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dia = pad(d.getDate());
  const mes = pad(d.getMonth() + 1);
  const anio = d.getFullYear();
  const hora = pad(d.getHours());
  const min = pad(d.getMinutes());
  const seg = pad(d.getSeconds());

  return {
    fechaStr: `${dia}/${mes}/${anio}`,
    fechaCorta: `${dia}.${mes}.${String(anio).slice(-2)}`,
    horaStr: `${hora}:${min}:${seg}`,
    horaCorta: `${hora}:${min}`,
  };
}

function getHoraRetiro(pedido) {
  if (pedido?.hora_retiro) return formatearHora(pedido.hora_retiro);
  if (pedido?.franja_retiro) return pedido.franja_retiro;
  if (pedido?.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) {
      return formatearHora(new Date(fecha.getTime() + 15 * 60000));
    }
  }
  return '—';
}

function normalizarItems(pedido) {
  const rawItems = pedido?.productos || pedido?.detalles_pedido || pedido?.items || [];
  let items = rawItems.map((prod, idx) => {
    if (prod.nombre && prod.cantidad !== undefined) return prod;
    const p = prod.productos || prod.PRODUCTOS || {};
    return {
      id: prod.id || prod.producto_id || (idx + 1),
      nombre: (Array.isArray(p) ? p[0]?.nombre : p?.nombre) || prod.nombre || 'PRODUCTO',
      cantidad: Number(prod.cantidad) || 1,
      precio: Number(prod.precio_unitario || prod.precio || p?.precio || 0),
      detalle: prod.nota || prod.modificaciones || prod.detalle || '',
    };
  });

  const totalMonto = Number(pedido?.total) || 0;
  if (items.length === 0 && totalMonto > 0) {
    items = [
      {
        id: 1,
        nombre: 'CONSUMO CAFETERÍA',
        cantidad: 1,
        precio: totalMonto,
        detalle: '',
      },
    ];
  }
  return items;
}

export const impresionService = {
  /**
   * Obtiene la información de impresión registrada para un pedido.
   * @param {string|number} pedidoId
   * @returns {{ veces: number, primeraImpresion: string|null, ultimaImpresion: string|null, esReimpresion: boolean }}
   */
  getEstadoImpresion(pedidoId) {
    if (!pedidoId) return { veces: 0, primeraImpresion: null, ultimaImpresion: null, esReimpresion: false };
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${pedidoId}`);
      if (!raw) return { veces: 0, primeraImpresion: null, ultimaImpresion: null, esReimpresion: false };
      const data = JSON.parse(raw);
      return {
        veces: Number(data.veces) || 0,
        primeraImpresion: data.primeraImpresion || null,
        ultimaImpresion: data.ultimaImpresion || null,
        esReimpresion: (Number(data.veces) || 0) > 0,
      };
    } catch {
      return { veces: 0, primeraImpresion: null, ultimaImpresion: null, esReimpresion: false };
    }
  },

  /**
   * Registra una impresión de comanda (incrementa conteo y actualiza timestamps).
   * @param {string|number} pedidoId
   * @returns {{ veces: number, esReimpresion: boolean }}
   */
  registrarImpresion(pedidoId) {
    if (!pedidoId) return { veces: 1, esReimpresion: false };
    try {
      const estadoActual = this.getEstadoImpresion(pedidoId);
      const ahora = new Date().toISOString();
      const nuevoEstado = {
        veces: estadoActual.veces + 1,
        primeraImpresion: estadoActual.primeraImpresion || ahora,
        ultimaImpresion: ahora,
      };
      localStorage.setItem(`${STORAGE_PREFIX}${pedidoId}`, JSON.stringify(nuevoEstado));
      return {
        veces: nuevoEstado.veces,
        esReimpresion: nuevoEstado.veces > 1,
      };
    } catch {
      return { veces: 1, esReimpresion: false };
    }
  },

  /**
   * Guarda un archivo PDF (boleta) permitiendo al usuario seleccionar la ubicación en su sistema.
   * Orden de preferencia:
   * 1. Electron `window.electronAPI.guardarArchivo` (diálogo nativo de guardado).
   * 2. Navegador moderno `window.showSaveFilePicker` (selector de guardado nativo del SO).
   * 3. Descarga HTML5 directa mediante enlace <a> como fallback.
   *
   * @param {Blob} blob - El archivo en formato Blob (ej. PDF generado)
   * @param {string} nombreSugerido - Nombre sugerido del archivo (ej. `boleta-pedido-123.pdf`)
   * @returns {Promise<{ ok: boolean, cancelado?: boolean, ruta?: string }>}
   */
  async guardarArchivoConUbicacion(blob, nombreSugerido = 'boleta.pdf') {
    // 1. Entorno Electron nativo
    if (window.electronAPI?.guardarArchivo) {
      try {
        const base64 = await blobToBase64(blob);
        const res = await window.electronAPI.guardarArchivo({
          nombreSugerido,
          extension: 'pdf',
          dataBase64: base64,
        });
        if (res?.cancelado) {
          return { ok: false, cancelado: true };
        }
        return { ok: true, ruta: res?.filePath };
      } catch (err) {
        console.error('Error al guardar archivo mediante Electron API:', err);
      }
    }

    // 2. Navegador con soporte para la API File System Access (Chrome, Edge, Opera, etc.)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: nombreSugerido,
          types: [
            {
              description: 'Documento PDF (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });

        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        return { ok: true, ruta: fileHandle.name };
      } catch (err) {
        if (err.name === 'AbortError') {
          return { ok: false, cancelado: true };
        }
        console.warn('Fallo showSaveFilePicker, recurriendo a descarga tradicional:', err);
      }
    }

    // 3. Fallback estándar de navegador web
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreSugerido;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return { ok: true, fallback: true };
    } catch (err) {
      console.error('Error en descarga de archivo fallback:', err);
      throw err;
    }
  },

  /**
   * Genera el HTML completo para la comanda de cocina térmica de 80mm.
   * Sin precios, con número de orden destacado, ítems, modificaciones y estado de reimpresión.
   *
   * @param {object} pedido
   * @param {object} estadoImpresion
   * @returns {string}
   */
  generarHtmlComanda(pedido, estadoImpresion = {}) {
    const cafe = obtenerInfoCafeteria(pedido);
    const codigoPedido = pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`;
    const horaRetiro = getHoraRetiro(pedido);
    const { fechaStr, horaStr } = getFechaYHora(pedido.creado_en);
    const clienteNombre =
      pedido.cliente ||
      pedido.cliente_nombre ||
      (pedido.usuario ? `${pedido.usuario.nombre || ''} ${pedido.usuario.apellido || ''}`.trim() : '') ||
      'Cliente General';

    const items = normalizarItems(pedido);
    const totalArticulos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
    const esReimpresion = Boolean(estadoImpresion?.esReimpresion);
    const vecesImpreso = estadoImpresion?.veces || 1;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Comanda - ${escapeHtml(codigoPedido)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 76mm;
      max-width: 80mm;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: 11px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      padding: 4mm 3mm 8mm 3mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: 800; }
    .title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 11px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .reimpresion-box {
      border: 2px dashed #000;
      padding: 4px 2px;
      margin: 5px 0;
      text-align: center;
    }
    .reimpresion-title {
      font-size: 12px;
      font-weight: 900;
    }
    .reimpresion-sub {
      font-size: 9px;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .divider-double {
      border-top: 2px dashed #000;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      font-size: 11px;
    }
    .row-large {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 3px 0;
      font-size: 12px;
    }
    .numero-orden {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .destacado {
      font-size: 13px;
      font-weight: 900;
    }
    .section-title {
      font-size: 11px;
      font-weight: 900;
      margin: 5px 0 3px 0;
    }
    .items-list {
      margin: 4px 0;
    }
    .item-cocina {
      margin: 5px 0;
      padding-bottom: 3px;
      border-bottom: 1px dotted #888;
    }
    .item-cocina:last-child {
      border-bottom: none;
    }
    .item-header {
      display: flex;
      font-size: 12px;
      font-weight: 800;
    }
    .item-cant {
      min-width: 28px;
      font-size: 13px;
    }
    .item-nombre {
      flex: 1;
      text-transform: uppercase;
    }
    .item-nota {
      margin-left: 28px;
      font-size: 10px;
      font-style: italic;
      color: #222;
    }
    .footer {
      font-size: 9px;
      text-align: center;
      margin-top: 6px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="text-center bold title">${escapeHtml(cafe.nombre)}</div>
  <div class="text-center subtitle">*** COMANDA DE COCINA ***</div>

  ${esReimpresion ? `
    <div class="reimpresion-box">
      <div class="reimpresion-title">*** REIMPRESIÓN (COPIA #${vecesImpreso}) ***</div>
      <div class="reimpresion-sub">Comanda ya enviada a preparación anteriormente</div>
    </div>
  ` : ''}

  <div class="divider"></div>

  <div class="row-large">
    <span class="bold">ORDEN:</span>
    <span class="bold numero-orden">${escapeHtml(codigoPedido)}</span>
  </div>

  <div class="row">
    <span>Fecha/Hora:</span>
    <span class="bold">${fechaStr} ${horaStr}</span>
  </div>

  <div class="row">
    <span>Hora Retiro:</span>
    <span class="bold destacado">${escapeHtml(horaRetiro)}</span>
  </div>

  ${clienteNombre ? `
    <div class="row">
      <span>Cliente:</span>
      <span class="bold">${escapeHtml(clienteNombre)}</span>
    </div>
  ` : ''}

  <div class="divider-double"></div>

  <div class="bold section-title">
    ÍTEMS A PREPARAR (${totalArticulos} productos):
  </div>

  <div class="items-list">
    ${items.map(it => `
      <div class="item-cocina">
        <div class="item-header">
          <span class="item-cant">${it.cantidad}x</span>
          <span class="item-nombre">${escapeHtml(it.nombre)}</span>
        </div>
        ${it.detalle && it.detalle !== 'Sin modificaciones' ? `
          <div class="item-nota">&gt; Nota: ${escapeHtml(it.detalle)}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  <div class="divider-double"></div>

  <div class="footer">
    Control de Cocina · CoffeeFast KDS<br>
    ${horaStr}
  </div>
</body>
</html>`;
  },

  /**
   * Genera el HTML completo para la boleta electrónica térmica de 80mm
   * emulando exactamente la boleta de ejemplo (formato chileno SII).
   *
   * @param {object} pedido
   * @returns {string}
   */
  generarHtmlBoleta(pedido) {
    const cafe = obtenerInfoCafeteria(pedido);
    const horaRetiro = getHoraRetiro(pedido);
    const { fechaStr, fechaCorta, horaStr, horaCorta } = getFechaYHora(pedido.creado_en);
    const clienteNombre =
      pedido.cliente ||
      pedido.cliente_nombre ||
      (pedido.usuario ? `${pedido.usuario.nombre || ''} ${pedido.usuario.apellido || ''}`.trim() : '') ||
      'Cliente General';

    const items = normalizarItems(pedido);
    const total = Number(pedido.total) || 0;
    const subtotalNeto = Math.round(total / 1.19);
    const iva = total - subtotalNeto;
    const totalArticulos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);

    const idLimpio = String(pedido.rawId ?? pedido.id).replace(/\D/g, '') || '1';
    const numeroBoletaElectronica = idLimpio.padStart(12, '0');

    const metodoPago = String(pedido.metodo_pago || 'WALLET').toUpperCase();
    const metodoPagoLabel = metodoPago.includes('WALLET')
      ? 'WALLET COFFEEFAST'
      : (metodoPago.includes('TARJETA') || metodoPago.includes('DEBITO') ? 'TBK DEBITO' : metodoPago);

    const codigoRetiro = pedido.codigo_retiro_diario || null;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Boleta - ${numeroBoletaElectronica}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 76mm;
      max-width: 80mm;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: 10px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      padding: 3mm 3mm 8mm 3mm;
    }
    .text-center { text-align: center; }
    .bold { font-weight: 800; }
    .cafe-name {
      font-size: 13px;
      font-weight: 900;
      margin-bottom: 2px;
    }
    .header-cafe {
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .space-sm { margin-top: 4px; }
    .space-xs { margin-top: 2px; }
    .row-sii {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
    }
    .linea-item-sii {
      margin: 4px 0;
    }
    .codigo-prod {
      font-size: 8.5px;
      color: #333;
    }
    .detalle-prod-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 10px;
    }
    .cant-x-precio {
      min-width: 48px;
    }
    .desc-prod {
      flex: 1;
      padding: 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .precio-total {
      text-align: right;
      min-width: 45px;
      font-weight: 700;
    }
    .nota-prod {
      font-size: 8.5px;
      font-style: italic;
      padding-left: 48px;
    }
    .totales-sii {
      margin-top: 4px;
      border-top: 1px dashed #000;
      padding-top: 3px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin: 1.5px 0;
    }
    .articulos-vend {
      font-size: 9px;
      font-weight: 800;
      margin-top: 3px;
      padding-top: 2px;
      border-top: 1px dotted #888;
    }
    .club-section {
      margin-top: 6px;
      font-size: 9.5px;
    }
    .club-data {
      margin: 3px 0;
      line-height: 1.3;
    }
    .codigo-destacado {
      font-size: 11px;
      margin-top: 2px;
    }
    .barcode-svg {
      width: 100%;
      height: 32px;
      margin: 5px 0;
    }
    .timbre-svg {
      width: 100%;
      height: 60px;
      margin: 4px 0;
    }
    .footer-sii {
      font-size: 8px;
      text-align: center;
      line-height: 1.3;
      margin-top: 4px;
    }
    .url-consulta {
      font-weight: 800;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <!-- 1. ENCABEZADO PROPIO DE LA CAFETERÍA -->
  <div class="text-center header-cafe">
    <div class="cafe-name">${escapeHtml(cafe.nombre)}</div>
    <div>RUT:  ${escapeHtml(cafe.rut)}</div>
    <div>SUC: ${escapeHtml(cafe.suc)}</div>
    <div>${escapeHtml(cafe.ciudad)}</div>
  </div>

  <div class="space-sm"></div>

  <!-- 2. DATOS DE BOLETA ELECTRÓNICA Y FECHA/HORA -->
  <div class="row-sii">
    <span>Bol. Electronica: ${numeroBoletaElectronica}</span>
    <span>Caja: ${escapeHtml(cafe.caja)}</span>
  </div>
  <div class="row-sii">
    <span>Fecha: ${fechaStr}</span>
    <span>Hora: ${horaStr}</span>
  </div>

  <div class="space-sm"></div>

  <!-- 3. LISTADO DE ÍTEMS -->
  <div>
    ${items.map((prod, idx) => {
      const cantidad = Number(prod.cantidad) || 1;
      const precioUnit = Number(prod.precio) || 0;
      const itemTotal = precioUnit * cantidad;
      const prodId = Number(prod.id || prod.producto_id || (idx + 1));
      const codigoEan = `780${String(prodId).padStart(10, '0')}`;

      return `
        <div class="linea-item-sii">
          <div class="codigo-prod">CODIGO: ${codigoEan}</div>
          <div class="detalle-prod-row">
            <span class="cant-x-precio">${cantidad}X${formatearMonto(precioUnit)}</span>
            <span class="desc-prod">${escapeHtml(String(prod.nombre || 'PRODUCTO').toUpperCase())}</span>
            <span class="precio-total">$ ${formatearMonto(itemTotal)}</span>
          </div>
          ${prod.detalle && prod.detalle !== 'Sin modificaciones' ? `
            <div class="nota-prod">* ${escapeHtml(String(prod.detalle).toUpperCase())}</div>
          ` : ''}
        </div>
      `;
    }).join('')}
  </div>

  <div class="space-sm"></div>

  <!-- 4. TOTALES Y CUADRO IMPOSITIVO -->
  <div class="totales-sii">
    <div class="total-row">
      <span>SUBTOTAL</span>
      <span>$  ${formatearMonto(total)}</span>
    </div>
    <div class="total-row">
      <span>TOTAL AFECTO $</span>
      <span>${formatearMonto(subtotalNeto)}</span>
    </div>
    <div class="total-row">
      <span>TOTAL EXENTO $</span>
      <span>0</span>
    </div>
    <div class="total-row">
      <span>TOTAL IVA(19.0%)$</span>
      <span>${formatearMonto(iva)}</span>
    </div>
    <div class="total-row bold">
      <span>TOTAL $</span>
      <span>${formatearMonto(total)}</span>
    </div>

    <div class="space-xs"></div>

    <div class="total-row">
      <span>${escapeHtml(metodoPagoLabel)}</span>
      <span>${formatearMonto(total)}</span>
    </div>
    <div class="total-row">
      <span>VUELTO</span>
      <span>0</span>
    </div>

    <div class="space-xs"></div>

    <div class="articulos-vend">
      TOTAL NUMERO DE ARTIC VEND = ${totalArticulos}
    </div>
  </div>

  <!-- 5. SECCIÓN CLUB COFFEEFAST -->
  <div class="club-section">
    <div class="text-center">***************************************</div>
    <div class="text-center bold">** CLUB COFFEEFAST **</div>
    <div class="text-center">***************************************</div>

    <div class="club-data">
      <div class="bold">${escapeHtml(clienteNombre)}</div>
      <div>Cliente CoffeeFast: *****${String(pedido.usuario_id || '2026').slice(-4)}</div>
      <div>Hora/Franja Retiro: ${escapeHtml(horaRetiro)}</div>
      ${codigoRetiro ? `
        <div class="bold codigo-destacado">CÓDIGO RETIRO: ${escapeHtml(codigoRetiro)}</div>
      ` : ''}
      <div class="text-center" style="font-size: 8px; margin-top: 2px;">
        Conserva esta boleta como comprobante de retiro.
      </div>
    </div>
  </div>

  <!-- 6. CÓDIGO DE BARRAS 1D -->
  <div>
    <svg viewBox="0 0 200 35" class="barcode-svg">
      <rect x="5" y="2" width="2" height="30" fill="#000" />
      <rect x="9" y="2" width="4" height="30" fill="#000" />
      <rect x="15" y="2" width="2" height="30" fill="#000" />
      <rect x="19" y="2" width="1" height="30" fill="#000" />
      <rect x="23" y="2" width="3" height="30" fill="#000" />
      <rect x="29" y="2" width="2" height="30" fill="#000" />
      <rect x="34" y="2" width="4" height="30" fill="#000" />
      <rect x="40" y="2" width="1" height="30" fill="#000" />
      <rect x="44" y="2" width="3" height="30" fill="#000" />
      <rect x="50" y="2" width="2" height="30" fill="#000" />
      <rect x="55" y="2" width="5" height="30" fill="#000" />
      <rect x="63" y="2" width="2" height="30" fill="#000" />
      <rect x="67" y="2" width="3" height="30" fill="#000" />
      <rect x="73" y="2" width="1" height="30" fill="#000" />
      <rect x="77" y="2" width="4" height="30" fill="#000" />
      <rect x="83" y="2" width="2" height="30" fill="#000" />
      <rect x="88" y="2" width="3" height="30" fill="#000" />
      <rect x="94" y="2" width="1" height="30" fill="#000" />
      <rect x="98" y="2" width="5" height="30" fill="#000" />
      <rect x="106" y="2" width="2" height="30" fill="#000" />
      <rect x="110" y="2" width="3" height="30" fill="#000" />
      <rect x="116" y="2" width="2" height="30" fill="#000" />
      <rect x="121" y="2" width="4" height="30" fill="#000" />
      <rect x="127" y="2" width="1" height="30" fill="#000" />
      <rect x="131" y="2" width="3" height="30" fill="#000" />
      <rect x="137" y="2" width="2" height="30" fill="#000" />
      <rect x="142" y="2" width="5" height="30" fill="#000" />
      <rect x="150" y="2" width="2" height="30" fill="#000" />
      <rect x="155" y="2" width="3" height="30" fill="#000" />
      <rect x="161" y="2" width="1" height="30" fill="#000" />
      <rect x="165" y="2" width="4" height="30" fill="#000" />
      <rect x="172" y="2" width="2" height="30" fill="#000" />
      <rect x="177" y="2" width="3" height="30" fill="#000" />
      <rect x="183" y="2" width="2" height="30" fill="#000" />
      <rect x="188" y="2" width="4" height="30" fill="#000" />
      <rect x="194" y="2" width="2" height="30" fill="#000" />
    </svg>
  </div>

  <!-- 7. TIMBRE ELECTRÓNICO SII (PDF417) -->
  <div>
    <svg viewBox="0 0 220 70" class="timbre-svg">
      <rect x="1" y="1" width="218" height="68" fill="#fff" stroke="#000" stroke-width="1.5" />
      <rect x="4" y="4" width="7" height="62" fill="#000" />
      <rect x="13" y="4" width="2" height="62" fill="#000" />
      <rect x="205" y="4" width="2" height="62" fill="#000" />
      <rect x="209" y="4" width="7" height="62" fill="#000" />
      <g fill="#000" opacity="0.9">
        ${Array.from({ length: 14 }).map((_, r) => `
          <g transform="translate(0, ${6 + r * 4.2})">
            <rect x="18" y="0" width="${((r * 13) % 9) + 4}" height="2.8" />
            <rect x="30" y="0" width="${((r * 7) % 11) + 3}" height="2.8" />
            <rect x="45" y="0" width="${((r * 17) % 13) + 5}" height="2.8" />
            <rect x="63" y="0" width="${((r * 5) % 8) + 4}" height="2.8" />
            <rect x="75" y="0" width="${((r * 11) % 15) + 3}" height="2.8" />
            <rect x="94" y="0" width="${((r * 9) % 10) + 6}" height="2.8" />
            <rect x="112" y="0" width="${((r * 19) % 12) + 4}" height="2.8" />
            <rect x="130" y="0" width="${((r * 3) % 9) + 5}" height="2.8" />
            <rect x="146" y="0" width="${((r * 15) % 11) + 4}" height="2.8" />
            <rect x="162" y="0" width="${((r * 8) % 14) + 6}" height="2.8" />
            <rect x="180" y="0" width="${((r * 14) % 10) + 4}" height="2.8" />
            <rect x="194" y="0" width="${((r * 6) % 8) + 3}" height="2.8" />
          </g>
        `).join('')}
      </g>
    </svg>
  </div>

  <!-- 8. LEYENDAS FISCALES -->
  <div class="footer-sii">
    <div>Timbre Electrónico SII Res. 80 de 2014</div>
    <div>0028 0988/004/${escapeHtml(cafe.caja)} ${fechaCorta} ${horaCorta} RC-00</div>
    <div>ATENDIDO POR : CAJERO KDS</div>
    <div class="space-xs"></div>
    <div class="url-consulta">Revisa tu boleta en: WWW.COFFEEFASTER.CL</div>
  </div>
</body>
</html>`;
  },

  /**
   * Imprime un documento HTML usando un iframe aislado off-screen.
   * Evita conflictos con el árbol de componentes de React, overflow:hidden del body
   * y trampas de foco (TrapFocus) de Material UI que congelan Chromium/Brave.
   *
   * @param {string} htmlContenido - Documento HTML autocontenido con estilos
   * @param {string} titulo - Título del documento de impresión
   * @returns {Promise<boolean>}
   */
  imprimirTicketHtml(htmlContenido, titulo = 'Ticket CoffeeFast') {
    return new Promise((resolve) => {
      const ID_IFRAME = 'kds-iframe-impresion';
      const previo = document.getElementById(ID_IFRAME);
      if (previo) {
        try { previo.remove(); } catch (_) {}
      }

      const iframe = document.createElement('iframe');
      iframe.id = ID_IFRAME;
      // Posición fuera de pantalla con dimensiones reales para que el motor
      // calcule layout y renderice texto y SVGs correctamente (sin hojas en blanco).
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '80mm';
      iframe.style.height = '120mm';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      iframe.title = titulo;

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!frameDoc) {
        try { iframe.remove(); } catch (_) {}
        resolve(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(htmlContenido);
      frameDoc.close();

      const lanzarImpresion = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.error('Error al imprimir desde iframe:', err);
          resolve(false);
        } finally {
          setTimeout(() => {
            try {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            } catch (_) {}
          }, 2500);
        }
      };

      // Breve margen para que el layout de fuentes y SVGs se procese completamente
      setTimeout(lanzarImpresion, 200);
    });
  },

  /**
   * Imprime la comanda de cocina térmica (80mm sin precios) vía iframe aislado.
   *
   * @param {object} pedido
   * @param {object} estadoImpresion
   * @returns {Promise<boolean>}
   */
  async imprimirComanda(pedido, estadoImpresion = {}) {
    const html = this.generarHtmlComanda(pedido, estadoImpresion);
    const titulo = `Comanda-${pedido?.codigo_pedido || pedido?.id || 'cocina'}`;
    return this.imprimirTicketHtml(html, titulo);
  },

  /**
   * Imprime la boleta térmica de cliente (80mm SII) vía iframe aislado.
   *
   * @param {object} pedido
   * @returns {Promise<boolean>}
   */
  async imprimirBoleta(pedido) {
    const html = this.generarHtmlBoleta(pedido);
    const titulo = `Boleta-${pedido?.codigo_pedido || pedido?.id || 'cliente'}`;
    return this.imprimirTicketHtml(html, titulo);
  },
};

export default impresionService;
