import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';

import { supabase } from '../lib/supabase';

// ─── Tipos ───────────────────────────────────────────────────────
interface Movimiento {
  id: string;
  tipo: 'recarga' | 'compra' | 'reembolso';
  monto: number;
  descripcion: string;
  creado_en: string;
}

interface Wallet {
  id: string;
  usuario_id: string;
  saldo_actual: number;
  moneda: string;
  actualizado_en: string;
}

// ─── Constantes ──────────────────────────────────────────────────
const SALDOS_RAPIDOS = [2000, 5000, 10000, 20000];

const COLORES = {
  cafeOscuro: '#4A332C',
  cafeMedio: '#8C6D58',
  fondo: '#F8F6F4',
  crema: '#F5EBE1',
  blanco: '#FFFFFF',
  verde: '#5B8C51',
  verdeBg: '#E8F3E4',
  rojo: '#A92A2A',
  rojoBg: '#FCEAE3',
  gris: '#958781',
  grisClaro: '#A09590',
  borde: '#EFE7DD',
  dorado: '#C9A96E',
  doradoBg: '#FBF5E8',
};

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
interface WalletScreenProps {
  userId: string | null;
}

const WalletScreen: React.FC<WalletScreenProps> = ({ userId }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recargaVisible, setRecargaVisible] = useState(false);
  const [montoRecarga, setMontoRecarga] = useState('');
  const [procesandoRecarga, setProcesandoRecarga] = useState(false);

  // ─── Obtener ID interno del usuario ────────────────────────────
  const obtenerUsuarioId = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', userId)
        .single();
      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.warn('Error obteniendo usuario_id:', err);
      return null;
    }
  }, [userId]);

  // ─── Cargar saldo ─────────────────────────────────────────────
  const cargarSaldo = useCallback(async () => {
    try {
      if (!userId) {
        setWallet(null);
        setMovimientos([]);
        return;
      }

      const usuarioId = await obtenerUsuarioId();
      if (!usuarioId) {
        setWallet(null);
        setMovimientos([]);
        return;
      }

      // Cargar o crear wallet
      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('usuario_id', usuarioId)
        .single();

      if (walletError && walletError.code === 'PGRST116') {
        // No existe, la creamos
        const { data: nueva, error: createError } = await supabase
          .from('wallets')
          .insert({ usuario_id: usuarioId, saldo_actual: 0 })
          .select()
          .single();

        if (!createError && nueva) {
          walletData = nueva;
        }
      } else if (walletError) {
        throw walletError;
      }

      setWallet(walletData as Wallet | null);

      // Cargar movimientos
      if (walletData) {
        const { data: movs, error: movsError } = await supabase
          .from('movimientos_wallet')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('creado_en', { ascending: false })
          .limit(20);

        if (!movsError && movs) {
          setMovimientos(movs as Movimiento[]);
        }
      }
    } catch (err) {
      console.warn('Error cargando saldo:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, obtenerUsuarioId]);

  useEffect(() => {
    cargarSaldo();
  }, [cargarSaldo]);

  // ─── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!wallet) return;

    const canal = supabase
      .channel('wallet-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `usuario_id=eq.${wallet.usuario_id}`,
        },
        () => {
          cargarSaldo();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'movimientos_wallet',
          filter: `wallet_id=eq.${wallet.id}`,
        },
        () => {
          cargarSaldo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [wallet, cargarSaldo]);

  // ─── Recargar saldo ───────────────────────────────────────────
  const handleRecarga = async (monto: number) => {
    if (!wallet || monto <= 0) return;

    setProcesandoRecarga(true);
    try {
      // Insertar movimiento
      const { error: movError } = await supabase.from('movimientos_wallet').insert({
        wallet_id: wallet.id,
        tipo: 'recarga',
        monto: monto,
        descripcion: `Recarga de saldo`,
      });

      if (movError) throw movError;

      // Actualizar saldo
      const nuevoSaldo = wallet.saldo_actual + monto;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ saldo_actual: nuevoSaldo })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      // Actualizar estado local inmediatamente
      setWallet((prev) => (prev ? { ...prev, saldo_actual: nuevoSaldo } : prev));
      setMovimientos((prev) => [
        {
          id: `temp-${Date.now()}`,
          tipo: 'recarga',
          monto: monto,
          descripcion: 'Recarga de saldo',
          creado_en: new Date().toISOString(),
        },
        ...prev,
      ]);

      setRecargaVisible(false);
      setMontoRecarga('');
    } catch (err) {
      Alert.alert('Error', 'No se pudo procesar la recarga. Inténtalo nuevamente.');
      console.warn('Error en recarga:', err);
    } finally {
      setProcesandoRecarga(false);
    }
  };

  // ─── Pull to refresh ──────────────────────────────────────────
  const onRefresh = () => {
    setRefreshing(true);
    cargarSaldo();
  };

  // ─── Render: No autenticado ───────────────────────────────────
  if (!userId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Wallet</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Inicia sesión</Text>
          <Text style={styles.emptyDescription}>
            Necesitas una cuenta para ver tu saldo y movimientos.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Render: Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Wallet</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORES.cafeOscuro} />
          <Text style={styles.loadingText}>Cargando tu saldo...</Text>
        </View>
      </View>
    );
  }

  const saldo = wallet?.saldo_actual ?? 0;
  const esSaldoCero = saldo === 0;
  const esSaldoBajo = saldo > 0 && saldo < 1000;

  // ─── Render: Principal ────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Wallet</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Text style={[styles.refreshIcon, refreshing && styles.refreshing]}>
            ↻
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORES.cafeOscuro}
            colors={[COLORES.cafeOscuro]}
          />
        }
      >
        {/* ─── Tarjeta de Saldo ─────────────────────────────── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardInner}>
            <View style={styles.balanceDecor1} />
            <View style={styles.balanceDecor2} />
            <View style={styles.balanceContent}>
              <Text style={styles.balanceLabel}>SALDO DISPONIBLE</Text>
              <Text style={styles.balanceValue}>{formatCLP(saldo)}</Text>
              <Text style={styles.balanceHint}>
                {esSaldoCero
                  ? 'Tu saldo está en $0. Recarga para pedir.'
                  : esSaldoBajo
                  ? 'Tu saldo está bajo. Considera recargar.'
                  : 'Listo para tus próximos pedidos'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Botones de Acción ────────────────────────────── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setRecargaVisible(true)}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>+</Text>
            </View>
            <Text style={styles.actionText}>Recargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
            <View style={[styles.actionIconContainer, styles.actionIconAlt]}>
              <Text style={styles.actionIcon}>↻</Text>
            </View>
            <Text style={styles.actionText}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Estadísticas Rápidas ─────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{movimientos.length}</Text>
            <Text style={styles.statLabel}>Movimientos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientos.filter((m) => m.tipo === 'compra').length}
            </Text>
            <Text style={styles.statLabel}>Compras</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientos.filter((m) => m.tipo === 'recarga').length}
            </Text>
            <Text style={styles.statLabel}>Recargas</Text>
          </View>
        </View>

        {/* ─── Historial de Movimientos ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos movimientos</Text>

          {movimientos.length === 0 ? (
            <View style={styles.emptyMovimientos}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>Sin movimientos todavía</Text>
              <Text style={styles.emptyDescription}>
                Tus recargas y compras aparecerán aquí para que lleves el control de tu saldo.
              </Text>
            </View>
          ) : (
            movimientos.map((mov) => (
              <View key={mov.id} style={styles.movimientoCard}>
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
                <View style={styles.movimientoInfo}>
                  <Text style={styles.movimientoName}>{mov.descripcion}</Text>
                  <Text style={styles.movimientoMeta}>
                    {getTipoLabel(mov.tipo)} • {formatFecha(mov.creado_en)}
                  </Text>
                </View>
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
              </View>
            ))
          )}

          <Text style={styles.footerText}>
            Las recargas y movimientos se sincronizan con tu cuenta Supabase.
          </Text>
        </View>
      </ScrollView>

      {/* ─── Modal de Recarga ───────────────────────────────── */}
      <Modal
        visible={recargaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRecargaVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recargar saldo</Text>
              <TouchableOpacity onPress={() => setRecargaVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Monto</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="$0"
              keyboardType="numeric"
              value={montoRecarga}
              onChangeText={setMontoRecarga}
              autoFocus
            />

            <Text style={styles.modalQuickLabel}>Saldos rápidos</Text>
            <View style={styles.quickAmountsRow}>
              {SALDOS_RAPIDOS.map((monto) => (
                <TouchableOpacity
                  key={monto}
                  style={styles.quickAmountBtn}
                  onPress={() => setMontoRecarga(monto.toString())}
                >
                  <Text style={styles.quickAmountText}>{formatCLP(monto)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!montoRecarga || procesandoRecarga) && styles.confirmButtonDisabled,
              ]}
              onPress={() => {
                const monto = parseInt(montoRecarga, 10);
                if (!isNaN(monto) && monto > 0) {
                  handleRecarga(monto);
                }
              }}
              disabled={!montoRecarga || procesandoRecarga}
            >
              {procesandoRecarga ? (
                <ActivityIndicator color={COLORES.blanco} />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar recarga</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  header: {
    height: 72,
    backgroundColor: COLORES.blanco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORES.cafeOscuro,
  },
  refreshIcon: {
    fontSize: 24,
    color: COLORES.cafeOscuro,
    fontWeight: '700',
  },
  refreshing: {
    opacity: 0.4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORES.gris,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },

  // ─── Tarjeta de Saldo ───────────────────────────────────────
  balanceCard: {
    backgroundColor: COLORES.cafeOscuro,
    borderRadius: 28,
    padding: 3,
    shadowColor: COLORES.cafeOscuro,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceCardInner: {
    backgroundColor: COLORES.cafeOscuro,
    borderRadius: 25,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  balanceDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201, 169, 110, 0.15)',
  },
  balanceDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  balanceContent: {
    position: 'relative',
    zIndex: 1,
  },
  balanceLabel: {
    color: COLORES.dorado,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  balanceValue: {
    color: COLORES.blanco,
    fontSize: 42,
    fontWeight: '800',
    fontFamily: 'serif',
    marginTop: 8,
  },
  balanceHint: {
    color: '#D8C9BD',
    fontSize: 12,
    marginTop: 6,
  },

  // ─── Botones de Acción ──────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORES.blanco,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORES.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORES.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionIconAlt: {
    backgroundColor: COLORES.crema,
  },
  actionIcon: {
    color: COLORES.blanco,
    fontSize: 18,
    fontWeight: '800',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORES.cafeOscuro,
  },

  // ─── Estadísticas ───────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORES.doradoBg,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E5D0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORES.cafeOscuro,
    fontFamily: 'serif',
  },
  statLabel: {
    fontSize: 10,
    color: COLORES.gris,
    marginTop: 2,
    fontWeight: '600',
  },

  // ─── Sección de Movimientos ────────────────────────────────
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORES.cafeOscuro,
    marginBottom: 12,
  },

  // ─── Movimiento Card ───────────────────────────────────────
  movimientoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.blanco,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORES.borde,
    shadowColor: '#000',
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
    backgroundColor: COLORES.rojoBg,
  },
  movimientoIconIn: {
    backgroundColor: COLORES.verdeBg,
  },
  movimientoIconOut: {
    backgroundColor: COLORES.rojoBg,
  },
  movimientoIconRefund: {
    backgroundColor: COLORES.doradoBg,
  },
  movimientoIconText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORES.cafeOscuro,
  },
  movimientoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  movimientoName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORES.cafeOscuro,
  },
  movimientoMeta: {
    fontSize: 10,
    color: COLORES.gris,
    marginTop: 2,
  },
  movimientoAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  movimientoAmountIn: {
    color: COLORES.verde,
  },
  movimientoAmountOut: {
    color: COLORES.rojo,
  },
  movimientoAmountRefund: {
    color: COLORES.dorado,
  },

  // ─── Empty State ────────────────────────────────────────────
  emptyMovimientos: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#F9F3EC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0E8DD',
    borderStyle: 'dashed',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.cafeOscuro,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: COLORES.gris,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORES.grisClaro,
    marginTop: 12,
  },

  // ─── Modal ──────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORES.blanco,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORES.cafeOscuro,
  },
  modalClose: {
    fontSize: 18,
    color: COLORES.gris,
    fontWeight: '700',
    padding: 4,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORES.gris,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: COLORES.fondo,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: COLORES.cafeOscuro,
    fontFamily: 'serif',
    borderWidth: 2,
    borderColor: COLORES.borde,
  },
  modalQuickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORES.gris,
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: COLORES.doradoBg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E5D0',
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORES.cafeOscuro,
  },
  confirmButton: {
    backgroundColor: COLORES.cafeOscuro,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORES.cafeOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: COLORES.blanco,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default WalletScreen;
