import React from 'react';
import { parsearFecha, formatearHora } from '../utils/dateUtils';
import { obtenerInfoCafeteria } from '../utils/cafeteriaInfo';

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

function formatearMonto(monto) {
  return Number(monto || 0).toLocaleString('es-CL');
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

export function TicketImpresion({ pedido, tipo = 'comanda', estadoImpresion = {} }) {
  if (!pedido) return null;

  const cafe = obtenerInfoCafeteria(pedido);
  const codigoPedido = pedido.codigo_pedido || `#${pedido.rawId ?? pedido.id}`;
  const horaRetiro = getHoraRetiro(pedido);
  const { fechaStr, fechaCorta, horaStr, horaCorta } = getFechaYHora(pedido.creado_en);
  const clienteNombre =
    pedido.cliente ||
    pedido.cliente_nombre ||
    (pedido.usuario ? `${pedido.usuario.nombre || ''} ${pedido.usuario.apellido || ''}`.trim() : '') ||
    'Cliente General';
  const rawItems = pedido.productos || pedido.detalles_pedido || pedido.items || [];
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

  const totalMonto = Number(pedido.total) || 0;
  if (items.length === 0 && totalMonto > 0) {
    items = [
      {
        id: 1,
        nombre: 'CONSUMO CAFETERÍA',
        cantidad: 1,
        precio: totalMonto,
      },
    ];
  }

  const esReimpresion = Boolean(estadoImpresion?.esReimpresion);
  const vecesImpreso = estadoImpresion?.veces || 1;

  // ==========================================
  // VISTA 1: COMANDA DE COCINA (80mm sin precios)
  // ==========================================
  if (tipo === 'comanda') {
    return (
      <div id="ticket-impresion" className="ticket-termico ticket-comanda">
        <div className="ticket-center ticket-bold ticket-title">
          {cafe.nombre}
        </div>
        <div className="ticket-center ticket-subtitle">
          *** COMANDA DE COCINA ***
        </div>

        {esReimpresion && (
          <div className="ticket-reimpresion-box">
            <div className="ticket-center ticket-bold">
              *** REIMPRESIÓN (COPIA #{vecesImpreso}) ***
            </div>
            <div className="ticket-center ticket-small">
              Comanda ya enviada a preparación anteriormente
            </div>
          </div>
        )}

        <div className="ticket-divider" />

        <div className="ticket-row-large">
          <span className="ticket-bold">ORDEN:</span>
          <span className="ticket-bold ticket-numero-orden">{codigoPedido}</span>
        </div>

        <div className="ticket-row">
          <span>Fecha/Hora:</span>
          <span className="ticket-bold">{fechaStr} {horaStr}</span>
        </div>

        <div className="ticket-row">
          <span>Hora Retiro:</span>
          <span className="ticket-bold ticket-destacado">{horaRetiro}</span>
        </div>

        {clienteNombre && (
          <div className="ticket-row">
            <span>Cliente:</span>
            <span>{clienteNombre}</span>
          </div>
        )}

        <div className="ticket-divider-double" />

        <div className="ticket-bold ticket-section-title">
          ÍTEMS A PREPARAR ({items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0)} productos):
        </div>

        <div className="ticket-items-list">
          {items.map((prod, idx) => (
            <div key={idx} className="ticket-item-cocina">
              <div className="ticket-item-header">
                <span className="ticket-item-cant">{prod.cantidad}x</span>
                <span className="ticket-item-nombre">{prod.nombre}</span>
              </div>
              {prod.detalle && prod.detalle !== 'Sin modificaciones' && (
                <div className="ticket-item-nota">
                  &gt; {prod.detalle}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ticket-divider-double" />

        <div className="ticket-center ticket-small ticket-footer-comanda">
          Control de Cocina · CoffeeFast KDS
          <br />
          {horaStr}
        </div>
      </div>
    );
  }

  // ==========================================
  // VISTA 2: BOLETA ELECTRÓNICA SII (Emulando foto Líder)
  // ==========================================
  const total = Number(pedido.total) || 0;
  const subtotalNeto = Math.round(total / 1.19);
  const iva = total - subtotalNeto;
  const totalArticulos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);

  // Formato número de boleta electrónica a 12 dígitos
  const idLimpio = String(pedido.rawId ?? pedido.id).replace(/\D/g, '') || '1';
  const numeroBoletaElectronica = idLimpio.padStart(12, '0');

  // Método de pago exacto tipo voucher
  const metodoPago = String(pedido.metodo_pago || 'WALLET').toUpperCase();
  const metodoPagoLabel = metodoPago.includes('WALLET')
    ? 'WALLET COFFEEFAST'
    : (metodoPago.includes('TARJETA') || metodoPago.includes('DEBITO') ? 'TBK DEBITO' : metodoPago);

  const codigoRetiro = pedido.codigo_retiro_diario || null;

  return (
    <div id="ticket-impresion" className="ticket-termico ticket-boleta-sii">
      {/* 1. ENCABEZADO PROPIO DE LA CAFETERÍA */}
      <div className="ticket-center ticket-mono ticket-header-cafe">
        <div className="ticket-bold ticket-cafe-name">{cafe.nombre}</div>
        <div>RUT:  {cafe.rut}</div>
        <div>SUC: {cafe.suc}</div>
        <div>{cafe.ciudad}</div>
      </div>

      <div className="ticket-space-sm" />

      {/* 2. DATOS DE BOLETA ELECTRÓNICA Y FECHA/HORA */}
      <div className="ticket-mono ticket-small">
        <div className="ticket-row-sii">
          <span>Bol. Electronica: {numeroBoletaElectronica}</span>
          <span>Caja: {cafe.caja}</span>
        </div>
        <div className="ticket-row-sii">
          <span>Fecha: {fechaStr}</span>
          <span>Hora: {horaStr}</span>
        </div>
      </div>

      <div className="ticket-space-sm" />

      {/* 3. LISTADO DE ÍTEMS EN FORMATO EXACTO (CODIGO / CANTIDADxPRECIO DESCRIPCION $ TOTAL) */}
      <div className="ticket-mono ticket-items-sii">
        {items.map((prod, idx) => {
          const cantidad = Number(prod.cantidad) || 1;
          const precioUnit = Number(prod.precio) || 0;
          const itemTotal = precioUnit * cantidad;
          // Código EAN13 ficticio pero consistente basado en el id del producto
          const prodId = Number(prod.id || prod.producto_id || (idx + 1));
          const codigoEan = `780${String(prodId).padStart(10, '0')}`;

          return (
            <div key={idx} className="ticket-linea-item-sii">
              <div className="ticket-codigo-prod">CODIGO: {codigoEan}</div>
              <div className="ticket-detalle-prod-row">
                <span className="ticket-cant-x-precio">
                  {cantidad}X{formatearMonto(precioUnit)}
                </span>
                <span className="ticket-desc-prod">
                  {String(prod.nombre || 'PRODUCTO').toUpperCase()}
                </span>
                <span className="ticket-precio-total">
                  $ {formatearMonto(itemTotal)}
                </span>
              </div>
              {prod.detalle && prod.detalle !== 'Sin modificaciones' && (
                <div className="ticket-nota-prod">
                  * {String(prod.detalle).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ticket-space-sm" />

      {/* 4. TOTALES Y CUADRO IMPOSITIVO SEGÚN FORMATO DE EJEMPLO */}
      <div className="ticket-mono ticket-totales-sii">
        <div className="ticket-total-row">
          <span className="ticket-label-tot">SUBTOTAL</span>
          <span className="ticket-val-tot">$  {formatearMonto(total)}</span>
        </div>
        <div className="ticket-total-row">
          <span className="ticket-label-tot">TOTAL AFECTO $</span>
          <span className="ticket-val-tot">{formatearMonto(subtotalNeto)}</span>
        </div>
        <div className="ticket-total-row">
          <span className="ticket-label-tot">TOTAL EXENTO $</span>
          <span className="ticket-val-tot">0</span>
        </div>
        <div className="ticket-total-row">
          <span className="ticket-label-tot">TOTAL IVA(19.0%)$</span>
          <span className="ticket-val-tot">{formatearMonto(iva)}</span>
        </div>
        <div className="ticket-total-row ticket-bold">
          <span className="ticket-label-tot">TOTAL $</span>
          <span className="ticket-val-tot">{formatearMonto(total)}</span>
        </div>

        <div className="ticket-space-xs" />

        <div className="ticket-total-row">
          <span className="ticket-label-tot">{metodoPagoLabel}</span>
          <span className="ticket-val-tot">{formatearMonto(total)}</span>
        </div>
        <div className="ticket-total-row">
          <span className="ticket-label-tot">VUELTO</span>
          <span className="ticket-val-tot">0</span>
        </div>

        <div className="ticket-space-xs" />

        <div className="ticket-articulos-vend">
          TOTAL NUMERO DE ARTIC VEND = {totalArticulos}
        </div>
      </div>

      {/* 5. SECCIÓN MI CLUB / DATOS DE RETIRO Y CLIENTE */}
      <div className="ticket-mono ticket-club-section">
        <div className="ticket-center">***************************************</div>
        <div className="ticket-center ticket-bold">** CLUB COFFEEFAST **</div>
        <div className="ticket-center">***************************************</div>

        <div className="ticket-club-data">
          <div className="ticket-bold">{clienteNombre}</div>
          <div>Cliente CoffeeFast: *****{String(pedido.usuario_id || '2026').slice(-4)}</div>
          <div>Hora/Franja Retiro: {horaRetiro}</div>
          {codigoRetiro && (
            <div className="ticket-bold ticket-codigo-destacado">
              CÓDIGO RETIRO: {codigoRetiro}
            </div>
          )}
          <div className="ticket-center ticket-small-notice">
            Conserva esta boleta como comprobante de retiro.
          </div>
        </div>
      </div>

      {/* 6. CÓDIGO DE BARRAS 1D */}
      <div className="ticket-barcode-1d-container">
        <svg viewBox="0 0 200 35" className="ticket-barcode-svg">
          {/* Simulación visual de código de barras 1D de ticket */}
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

      {/* 7. TIMBRE ELECTRÓNICO SII (PDF417) - EMULANDO EL SELLO FISCAL CHILENO */}
      <div className="ticket-timbre-sii-box">
        <svg viewBox="0 0 220 70" className="ticket-timbre-svg">
          {/* Borde exterior del timbre */}
          <rect x="1" y="1" width="218" height="68" fill="#fff" stroke="#000" strokeWidth="1.5" />
          
          {/* Barras verticales gruesas características en bordes laterales */}
          <rect x="4" y="4" width="7" height="62" fill="#000" />
          <rect x="13" y="4" width="2" height="62" fill="#000" />
          
          <rect x="205" y="4" width="2" height="62" fill="#000" />
          <rect x="209" y="4" width="7" height="62" fill="#000" />

          {/* Patrón matricial 2D característico de firma electrónica SII */}
          <g fill="#000" opacity="0.9">
            {Array.from({ length: 14 }).map((_, r) => (
              <g key={r} transform={`translate(0, ${6 + r * 4.2})`}>
                <rect x="18" y="0" width={((r * 13) % 9) + 4} height="2.8" />
                <rect x="30" y="0" width={((r * 7) % 11) + 3} height="2.8" />
                <rect x="45" y="0" width={((r * 17) % 13) + 5} height="2.8" />
                <rect x="63" y="0" width={((r * 5) % 8) + 4} height="2.8" />
                <rect x="75" y="0" width={((r * 11) % 15) + 3} height="2.8" />
                <rect x="94" y="0" width={((r * 9) % 10) + 6} height="2.8" />
                <rect x="112" y="0" width={((r * 19) % 12) + 4} height="2.8" />
                <rect x="130" y="0" width={((r * 3) % 9) + 5} height="2.8" />
                <rect x="146" y="0" width={((r * 15) % 11) + 4} height="2.8" />
                <rect x="162" y="0" width={((r * 8) % 14) + 6} height="2.8" />
                <rect x="180" y="0" width={((r * 14) % 10) + 4} height="2.8" />
                <rect x="194" y="0" width={((r * 6) % 8) + 3} height="2.8" />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* 8. LEYENDAS FISCALES Y PIE DE PÁGINA */}
      <div className="ticket-mono ticket-footer-sii">
        <div>Timbre Electrónico SII Res. 80 de 2014</div>
        <div>0028 0988/004/{cafe.caja} {fechaCorta} {horaCorta} RC-00</div>
        <div>ATENDIDO POR : CAJERO KDS</div>
        <div className="ticket-space-xs" />
        <div className="ticket-url-consulta">Revisa tu boleta en: WWW.COFFEEFASTER.CL</div>
      </div>
    </div>
  );
}

export default TicketImpresion;
