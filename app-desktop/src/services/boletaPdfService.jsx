import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

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

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 12,
    fontFamily: 'Courier',
    fontSize: 7.5,
    lineHeight: 1.25,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerCafe: {
    textAlign: 'center',
    marginBottom: 6,
  },
  cafeName: {
    fontFamily: 'Courier-Bold',
    fontSize: 9,
    marginBottom: 1,
  },
  centerText: {
    textAlign: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  docHeader: {
    marginTop: 3,
    marginBottom: 5,
  },
  dividerDashed: {
    borderTopWidth: 0.8,
    borderTopColor: '#000000',
    borderTopStyle: 'dashed',
    marginVertical: 4,
  },
  itemsSection: {
    marginVertical: 3,
  },
  itemBlock: {
    marginBottom: 3,
  },
  itemCodigo: {
    fontSize: 7,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemCantXPrecio: {
    width: '32%',
  },
  itemDesc: {
    width: '42%',
  },
  itemTotal: {
    width: '26%',
    textAlign: 'right',
  },
  itemNota: {
    fontSize: 6.5,
    paddingLeft: 8,
    fontFamily: 'Courier-Oblique',
  },
  totalesSection: {
    marginTop: 3,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 1,
  },
  totalLabel: {
    width: '60%',
    textAlign: 'right',
    paddingRight: 6,
  },
  totalVal: {
    width: '30%',
    textAlign: 'right',
  },
  totalBold: {
    fontFamily: 'Courier-Bold',
  },
  articulosVend: {
    marginTop: 3,
    fontSize: 7.5,
    fontFamily: 'Courier-Bold',
  },
  clubSection: {
    marginVertical: 4,
    textAlign: 'center',
  },
  clubData: {
    marginTop: 2,
    lineHeight: 1.25,
  },
  barcodeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 18,
    marginVertical: 4,
  },
  timbreOuter: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 2,
    marginVertical: 4,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  timbreSideBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#000000',
  },
  timbreSideThin: {
    width: 1,
    height: '100%',
    backgroundColor: '#000000',
    marginHorizontal: 1,
  },
  timbreCenter: {
    flex: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timbreMatrixRow: {
    flexDirection: 'row',
    width: '100%',
    height: 2,
    marginVertical: 0.8,
  },
  footerSection: {
    textAlign: 'center',
    fontSize: 6.5,
    lineHeight: 1.2,
    marginTop: 3,
  },
  footerUrl: {
    fontFamily: 'Courier-Bold',
    fontSize: 7,
    marginTop: 2,
  },
});

export function BoletaDocument({ pedido }) {
  const cafe = obtenerInfoCafeteria(pedido);
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

  const total = Number(pedido?.total) || 0;
  if (items.length === 0 && total > 0) {
    items = [
      {
        id: 1,
        nombre: 'CONSUMO CAFETERÍA',
        cantidad: 1,
        precio: total,
      },
    ];
  }

  const { fechaStr, fechaCorta, horaStr, horaCorta } = getFechaYHora(pedido?.creado_en);
  const horaRetiro = getHoraRetiro(pedido);

  const subtotalNeto = Math.round(total / 1.19);
  const iva = total - subtotalNeto;
  const totalArticulos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);

  const idLimpio = String(pedido?.rawId ?? pedido?.id ?? '1').replace(/\D/g, '') || '1';
  const numeroBoletaElectronica = idLimpio.padStart(12, '0');

  const metodoPago = String(pedido?.metodo_pago || 'WALLET').toUpperCase();
  const metodoPagoLabel = metodoPago.includes('WALLET')
    ? 'WALLET COFFEEFAST'
    : (metodoPago.includes('TARJETA') || metodoPago.includes('DEBITO') ? 'TBK DEBITO' : metodoPago);

  const clienteNombre = (pedido?.cliente || 'CLIENTE GENERAL').toUpperCase();
  const codigoRetiro = pedido?.codigo_retiro_diario || null;

  // Altura calculada dinámicamente para que el PDF se ajuste exactamente como un rollo térmico continuo
  const baseHeight = 360;
  const calculatedHeight = Math.max(400, baseHeight + items.length * 18);

  return (
    <Document>
      <Page size={[226.77, calculatedHeight]} style={styles.page}>
        {/* 1. ENCABEZADO PROPIO DE LA CAFETERÍA */}
        <View style={styles.headerCafe}>
          <Text style={styles.cafeName}>{cafe.nombre}</Text>
          <Text>RUT:  {cafe.rut}</Text>
          <Text>SUC: {cafe.suc}</Text>
          <Text>{cafe.ciudad}</Text>
        </View>

        {/* 2. DATOS DE BOLETA ELECTRÓNICA Y FECHA/HORA */}
        <View style={styles.docHeader}>
          <View style={styles.rowBetween}>
            <Text>Bol. Electronica: {numeroBoletaElectronica}</Text>
            <Text>Caja: {cafe.caja}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text>Fecha: {fechaStr}</Text>
            <Text>Hora: {horaStr}</Text>
          </View>
        </View>

        <View style={styles.dividerDashed} />

        {/* 3. LISTADO DE ÍTEMS EN FORMATO EXACTO (CODIGO / CANTXPRECIO DESCRIPCION $ TOTAL) */}
        <View style={styles.itemsSection}>
          {items.map((prod, idx) => {
            const cantidad = Number(prod.cantidad) || 1;
            const precioUnit = Number(prod.precio) || 0;
            const itemTotal = precioUnit * cantidad;
            const prodId = Number(prod.id || prod.producto_id || (idx + 1));
            const codigoEan = `780${String(prodId).padStart(10, '0')}`;

            return (
              <View key={idx} style={styles.itemBlock}>
                <Text style={styles.itemCodigo}>CODIGO: {codigoEan}</Text>
                <View style={styles.itemRow}>
                  <Text style={styles.itemCantXPrecio}>
                    {cantidad}X{formatearMonto(precioUnit)}
                  </Text>
                  <Text style={styles.itemDesc}>
                    {String(prod.nombre || 'PRODUCTO').toUpperCase().slice(0, 16)}
                  </Text>
                  <Text style={styles.itemTotal}>
                    $ {formatearMonto(itemTotal)}
                  </Text>
                </View>
                {prod.detalle && prod.detalle !== 'Sin modificaciones' && (
                  <Text style={styles.itemNota}>
                    * {String(prod.detalle).toUpperCase()}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.dividerDashed} />

        {/* 4. TOTALES Y CUADRO IMPOSITIVO */}
        <View style={styles.totalesSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SUBTOTAL</Text>
            <Text style={styles.totalVal}>$  {formatearMonto(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL AFECTO $</Text>
            <Text style={styles.totalVal}>{formatearMonto(subtotalNeto)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL EXENTO $</Text>
            <Text style={styles.totalVal}>0</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL IVA(19.0%)$</Text>
            <Text style={styles.totalVal}>{formatearMonto(iva)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.totalBold]}>TOTAL $</Text>
            <Text style={[styles.totalVal, styles.totalBold]}>{formatearMonto(total)}</Text>
          </View>

          <View style={{ height: 2 }} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{metodoPagoLabel}</Text>
            <Text style={styles.totalVal}>{formatearMonto(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VUELTO</Text>
            <Text style={styles.totalVal}>0</Text>
          </View>

          <Text style={styles.articulosVend}>
            TOTAL NUMERO DE ARTIC VEND = {totalArticulos}
          </Text>
        </View>

        {/* 5. SECCIÓN MI CLUB / DATOS DE RETIRO */}
        <View style={styles.clubSection}>
          <Text style={styles.centerText}>***************************************</Text>
          <Text style={[styles.centerText, styles.totalBold]}>** CLUB COFFEEFAST **</Text>
          <Text style={styles.centerText}>***************************************</Text>
          <View style={styles.clubData}>
            <Text style={[styles.centerText, styles.totalBold]}>{clienteNombre}</Text>
            <Text style={styles.centerText}>Cliente: *****{String(pedido?.usuario_id || '2026').slice(-4)}</Text>
            <Text style={styles.centerText}>Retiro: {horaRetiro}</Text>
            {codigoRetiro && (
              <Text style={[styles.centerText, styles.totalBold]}>
                CÓDIGO RETIRO: {codigoRetiro}
              </Text>
            )}
            <Text style={[styles.centerText, { fontSize: 6, fontStyle: 'italic', marginTop: 2 }]}>
              Conserva esta boleta como comprobante de retiro.
            </Text>
          </View>
        </View>

        {/* 6. CÓDIGO DE BARRAS 1D */}
        <View style={styles.barcodeContainer}>
          {Array.from({ length: 38 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: (i % 4 === 0 ? 3 : (i % 3 === 0 ? 1.5 : 1)),
                height: 14,
                backgroundColor: '#000000',
                marginRight: (i % 2 === 0 ? 1.5 : 1),
              }}
            />
          ))}
        </View>

        {/* 7. TIMBRE ELECTRÓNICO SII (PDF417) */}
        <View style={styles.timbreOuter}>
          <View style={{ flexDirection: 'row', height: '100%' }}>
            <View style={styles.timbreSideBar} />
            <View style={styles.timbreSideThin} />
          </View>

          <View style={styles.timbreCenter}>
            {Array.from({ length: 8 }).map((_, r) => (
              <View key={r} style={styles.timbreMatrixRow}>
                <View style={{ width: ((r * 11) % 18) + 8, height: 1.8, backgroundColor: '#000000', marginRight: 4 }} />
                <View style={{ width: ((r * 7) % 22) + 12, height: 1.8, backgroundColor: '#000000', marginRight: 4 }} />
                <View style={{ width: ((r * 13) % 28) + 14, height: 1.8, backgroundColor: '#000000', marginRight: 4 }} />
                <View style={{ width: ((r * 5) % 16) + 10, height: 1.8, backgroundColor: '#000000', marginRight: 4 }} />
                <View style={{ width: ((r * 9) % 20) + 12, height: 1.8, backgroundColor: '#000000' }} />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', height: '100%' }}>
            <View style={styles.timbreSideThin} />
            <View style={styles.timbreSideBar} />
          </View>
        </View>

        {/* 8. LEYENDAS FISCALES Y PIE */}
        <View style={styles.footerSection}>
          <Text>Timbre Electrónico SII Res. 80 de 2014</Text>
          <Text>0028 0988/004/{cafe.caja} {fechaCorta} {horaCorta} RC-00</Text>
          <Text>ATENDIDO POR : CAJERO KDS</Text>
          <Text style={styles.footerUrl}>Revisa tu boleta en: WWW.COFFEEFASTER.CL</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generarBoletaBlob(pedido) {
  const doc = <BoletaDocument pedido={pedido} />;
  return await pdf(doc).toBlob();
}

export default BoletaDocument;
