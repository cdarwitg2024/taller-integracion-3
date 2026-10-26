import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Button from '../components/Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// ─── Tipos ───────────────────────────────────────────────────────
export interface Movimiento {
  id: string;
  tipo: 'recarga' | 'compra' | 'reembolso';
  monto: number;
  descripcion: string;
  creado_en: string;
  pedido_id?: number | null;
}

interface MovimientoItemProps {
  mov: Movimiento;
  index: number;
}

// ─── Helpers ─────────────────────────────────────────────────────
const formatCLP = (monto: number): string => {
  return `$${Math.abs(monto).toLocaleString('es-CL')}`;
};

const formatFecha = (iso: string): string => {
  const fecha = new Date(iso);
  const ahora = new Date();
  const diffHoras = (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60);

  if (diffHoras < 1) {
    return 'Hace un momento';
  }
  if (diffHoras < 24) {
    return `Hace ${Math.floor(diffHoras)}h`;
  }
  if (diffHoras < 48) {
    return 'Ayer';
  }
  return fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFechaCompleta = (iso: string): string => {
  try {
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return String(iso);
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
};

const getTipoLabel = (tipo: string): string => {
  switch (tipo) {
    case 'recarga':
      return 'Recarga';
    case 'compra':
      return 'Compra';
    case 'reembolso':
      return 'Reembolso';
    default:
      return tipo;
  }
};

// ─── Componente Principal ────────────────────────────────────────
const MovimientoItem: React.FC<MovimientoItemProps> = ({ mov, index }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const esNuevo = String(mov?.id || '').startsWith('temp-');
  const entradaAnim = useRef(new Animated.Value(esNuevo ? 0 : 1)).current;

  const esIngreso = mov.tipo === 'recarga' || mov.tipo === 'reembolso';
  const tienePedido =
    mov.pedido_id !== null &&
    mov.pedido_id !== undefined &&
    Number(mov.pedido_id) > 0;
  const flujoTexto = esIngreso ? 'Ingreso' : 'Egreso';
  const pedidoTexto = tienePedido
    ? `, asociado al pedido número ${mov.pedido_id}`
    : '';

  // Etiqueta semántica completa para lectores de pantalla (TalkBack / VoiceOver)
  const accessibilityLabel = `${flujoTexto} por ${getTipoLabel(
    mov.tipo
  )}. Concepto: ${mov.descripcion}. Monto: ${
    esIngreso ? 'abono de' : 'descuento de'
  } ${formatCLP(mov.monto)}${pedidoTexto}. Fecha: ${formatFecha(
    mov.creado_en
  )}.`;

  useEffect(() => {
    if (esNuevo) {
      Animated.timing(entradaAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [esNuevo, entradaAnim]);

  return (
    <>
      <Animated.View
        style={[
          styles.movimientoCardContainer,
          {
            opacity: entradaAnim,
            transform: [
              {
                translateY: entradaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              {
                scale: entradaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.movimientoCard}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Toca dos veces para ver el detalle de este movimiento"
        >
          {/* Ícono temático */}
          <View
            style={[
              styles.movimientoIcon,
              mov.tipo === 'recarga' && styles.movimientoIconIn,
              mov.tipo === 'compra' && styles.movimientoIconOut,
              mov.tipo === 'reembolso' && styles.movimientoIconRefund,
            ]}
          >
            <Text style={styles.movimientoIconText}>
              {mov.tipo === 'recarga' ? '+' : mov.tipo === 'compra' ? '−' : '↩'}
            </Text>
          </View>

          {/* Información principal */}
          <View style={styles.movimientoInfo}>
            <Text style={styles.movimientoName} numberOfLines={1}>
              {mov.descripcion}
            </Text>
            <View style={styles.movimientoMetaRow}>
              <Text style={styles.movimientoMeta}>
                {getTipoLabel(mov.tipo)} • {formatFecha(mov.creado_en)}
              </Text>
              {tienePedido && (
                <View style={styles.pedidoBadge}>
                  <Text style={styles.pedidoBadgeText}>📦 #{mov.pedido_id}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Monto y etiqueta accesible de flujo */}
          <View style={styles.amountContainer}>
            <Text
              style={[
                styles.movimientoAmount,
                mov.tipo === 'recarga' && styles.movimientoAmountIn,
                mov.tipo === 'compra' && styles.movimientoAmountOut,
                mov.tipo === 'reembolso' && styles.movimientoAmountRefund,
              ]}
            >
              {mov.tipo === 'compra' ? '−' : '+'}
              {formatCLP(mov.monto)}
            </Text>
            <Text
              style={[
                styles.flowTag,
                esIngreso ? styles.flowTagIngreso : styles.flowTagEgreso,
              ]}
            >
              {flujoTexto}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Modal de Detalle Visual del Movimiento ───────────────── */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Encabezado del Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Detalle del Movimiento</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cerrar detalle"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Hero del Monto */}
            <View style={styles.modalHero}>
              <View
                style={[
                  styles.modalHeroIcon,
                  mov.tipo === 'recarga' && styles.movimientoIconIn,
                  mov.tipo === 'compra' && styles.movimientoIconOut,
                  mov.tipo === 'reembolso' && styles.movimientoIconRefund,
                ]}
              >
                <Text style={styles.modalHeroIconText}>
                  {mov.tipo === 'recarga' ? '+' : mov.tipo === 'compra' ? '−' : '↩'}
                </Text>
              </View>
              <Text
                style={[
                  styles.modalHeroAmount,
                  mov.tipo === 'recarga' && styles.movimientoAmountIn,
                  mov.tipo === 'compra' && styles.movimientoAmountOut,
                  mov.tipo === 'reembolso' && styles.movimientoAmountRefund,
                ]}
              >
                {mov.tipo === 'compra' ? '−' : '+'}
                {formatCLP(mov.monto)}
              </Text>
              <View
                style={[
                  styles.modalHeroBadge,
                  esIngreso
                    ? styles.modalHeroBadgeIngreso
                    : styles.modalHeroBadgeEgreso,
                ]}
              >
                <Text
                  style={[
                    styles.modalHeroBadgeText,
                    esIngreso ? styles.badgeTextIngreso : styles.badgeTextEgreso,
                  ]}
                >
                  {esIngreso ? '● Ingreso a cuenta' : '● Egreso por compra'}
                </Text>
              </View>
            </View>

            {/* Detalle estructurado */}
            <View style={styles.modalDetailsList}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Tipo de movimiento</Text>
                <Text style={styles.modalDetailValue}>{getTipoLabel(mov.tipo)}</Text>
              </View>
              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Concepto</Text>
                <Text style={styles.modalDetailValue} numberOfLines={2}>
                  {mov.descripcion}
                </Text>
              </View>
              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Fecha y hora</Text>
                <Text style={styles.modalDetailValue}>
                  {formatFechaCompleta(mov.creado_en)}
                </Text>
              </View>
              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Pedido relacionado</Text>
                {tienePedido ? (
                  <View style={styles.modalPedidoTag}>
                    <Text style={styles.modalPedidoTagText}>
                      📦 Pedido #{mov.pedido_id}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.modalDetailSubvalue}>
                    No aplica (abono directo)
                  </Text>
                )}
              </View>
              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>ID de transacción</Text>
                <Text style={styles.modalDetailSubvalue}>#{mov.id}</Text>
              </View>
            </View>

            {/* Botón de cierre */}
            <Button
              title="Entendido"
              variant="primary"
              size="md"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  movimientoCardContainer: {
    marginBottom: 10,
  },
  movimientoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borde,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  movimientoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.rojoBg,
  },
  movimientoIconIn: {
    backgroundColor: colors.verdeBg,
  },
  movimientoIconOut: {
    backgroundColor: colors.rojoBg,
  },
  movimientoIconRefund: {
    backgroundColor: colors.doradoBg,
  },
  movimientoIconText: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  movimientoInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  movimientoName: {
    fontSize: 13,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },
  movimientoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  movimientoMeta: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
  },
  pedidoBadge: {
    backgroundColor: colors.crema,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  pedidoBadgeText: {
    fontSize: 10,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  movimientoAmount: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoExtraBold,
  },
  movimientoAmountIn: {
    color: colors.verde,
  },
  movimientoAmountOut: {
    color: colors.rojo,
  },
  movimientoAmountRefund: {
    color: colors.dorado,
  },
  flowTag: {
    fontSize: 10,
    fontWeight: typography.pesoMedio,
    marginTop: 2,
  },
  flowTagIngreso: {
    color: colors.verde,
  },
  flowTagEgreso: {
    color: colors.rojo,
  },

  // ─── Modal de Detalle ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.blanco,
    borderRadius: 24,
    padding: spacing.xl,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalHeaderTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fondo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
  },
  modalHero: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalHeroIconText: {
    fontSize: 24,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  modalHeroAmount: {
    fontSize: 32,
    fontWeight: typography.pesoExtraBold,
    fontFamily: typography.familia,
  },
  modalHeroBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
  },
  modalHeroBadgeIngreso: {
    backgroundColor: colors.verdeBg,
  },
  modalHeroBadgeEgreso: {
    backgroundColor: colors.rojoBg,
  },
  modalHeroBadgeText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
  },
  badgeTextIngreso: {
    color: colors.verde,
  },
  badgeTextEgreso: {
    color: colors.rojo,
  },
  modalDetailsList: {
    backgroundColor: colors.fondo,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalDetailLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    flex: 1,
  },
  modalDetailValue: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    textAlign: 'right',
    flex: 1.2,
  },
  modalDetailSubvalue: {
    fontSize: typography.cuerpoPequeno,
    color: colors.cafeMedio,
    textAlign: 'right',
  },
  modalPedidoTag: {
    backgroundColor: colors.crema,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  modalPedidoTagText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: 4,
  },
  modalButton: {
    width: '100%',
  },
});

export default MovimientoItem;
