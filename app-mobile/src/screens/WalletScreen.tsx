import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';

import { supabase } from '../lib/supabase';
import PaymentScreen from './PaymentScreen';
import MovimientoItem from './MovimientoItem';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

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
  const [montoSeleccionado, setMontoSeleccionado] = useState(0);
  const [saldoMostrado, setSaldoMostrado] = useState(0);
  const saldoAnterior = useRef(0);

  // ─── Animaciones ─────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const saldoAnim = useRef(new Animated.Value(0)).current;
  const recargaScale = useRef(new Animated.Value(1)).current;
  const saldoInterpolado = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      // Animación de entrada: fade + slide + scale
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();

      // Animación del saldo (contador)
      Animated.timing(saldoAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const animarRecarga = () => {
    Animated.sequence([
      Animated.timing(recargaScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(recargaScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

  // Inicializar saldoMostrado con el saldo real cuando wallet cambia
  useEffect(() => {
    if (wallet) {
      setSaldoMostrado(wallet.saldo_actual);
    }
  }, [wallet]);

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
      // El saldo NO se actualiza con un UPDATE desde el cliente: la politica
      // `wallets_update_own` no existe a proposito, para que nadie se ponga un
      // saldo arbitrario. Ese UPDATE fallaba en silencio (RLS -> 0 filas ->
      // HTTP 204), la app sumaba en pantalla y al refrescar volvia el saldo
      // viejo. La recarga va por la RPC `recargar_saldo`, que suma, deja el
      // movimiento y devuelve el saldo real leido de la base.
      console.log('=== DEBUG recargar_saldo ===');
      console.log('Monto:', monto);
      console.log('Wallet:', wallet);

      const { data, error } = await supabase.rpc('recargar_saldo', {
        p_monto: monto,
      });

      console.log('Error en recargar_saldo:', error);
      console.log('Data:', data);
      console.log('=== FIN DEBUG ===');

      if (error) throw error;

      const res = data as {
        ok: boolean;
        motivo?: string;
        mensaje?: string;
        saldo_nuevo?: number;
      } | null;

      if (!res?.ok) {
        Alert.alert('No se pudo recargar', res?.mensaje || 'Intenta nuevamente.');
        return;
      }

      // Animar el saldo con interpolación suave (sin saltos bruscos)
      const nuevoSaldo = res.saldo_nuevo ?? 0;
      saldoAnterior.current = wallet.saldo_actual;
      saldoInterpolado.setValue(saldoAnterior.current);
      setSaldoMostrado(saldoAnterior.current);
      Animated.timing(saldoInterpolado, {
        toValue: nuevoSaldo,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setSaldoMostrado(nuevoSaldo);
        }
      });

      // El saldo se toma del servidor, no se calcula aqui.
      setWallet((prev) =>
        prev ? { ...prev, saldo_actual: nuevoSaldo } : prev
      );
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
      setMontoSeleccionado(0);
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
          <ActivityIndicator size="large" color={colors.cafeOscuro} />
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
            tintColor={colors.cafeOscuro}
            colors={[colors.cafeOscuro]}
          />
        }
      >
        {/* ─── Tarjeta de Saldo (animada) ───────────────────── */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Card variant="elevated" padding="none" style={styles.balanceCard}>
          <View style={styles.balanceCardInner}>
            <View style={styles.balanceDecor1} />
            <View style={styles.balanceDecor2} />
            <View style={styles.balanceContent}>
              <Text style={styles.balanceLabel}>SALDO DISPONIBLE</Text>
              <Animated.Text
                style={[
                  styles.balanceValue,
                  {
                    opacity: saldoAnim,
                    transform: [
                      {
                        scale: saldoAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {`$${saldoMostrado.toLocaleString('es-CL')}`}
              </Animated.Text>
              <Text style={styles.balanceHint}>
                {esSaldoCero
                  ? 'Tu saldo está en $0. Recarga para pedir.'
                  : esSaldoBajo
                  ? 'Tu saldo está bajo. Considera recargar.'
                  : 'Listo para tus próximos pedidos'}
              </Text>
            </View>
          </View>
          </Card>
        </Animated.View>

        {/* ─── Botones de Acción (animados) ─────────────────── */}
        <Animated.View
          style={[
            styles.actionsRow,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.actionButton}
            onPressIn={animarRecarga}
            onPress={() => setMontoSeleccionado(5000)}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.actionIconContainer,
                { transform: [{ scale: recargaScale }] },
              ]}
            >
              <Text style={styles.actionIcon}>+</Text>
            </Animated.View>
            <Text style={styles.actionText}>Recargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onRefresh} activeOpacity={0.8}>
            <View style={[styles.actionIconContainer, styles.actionIconAlt]}>
              <Text style={styles.actionIcon}>↻</Text>
            </View>
            <Text style={styles.actionText}>Actualizar</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ─── Estadísticas Rápidas (animadas) ─────────────── */}
        <Animated.View
          style={[
            styles.statsRow,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Card variant="outlined" padding="none" style={styles.statCard}>
            <Text style={styles.statValue}>{movimientos.length}</Text>
            <Text style={styles.statLabel}>Movimientos</Text>
          </Card>
          <Card variant="outlined" padding="none" style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientos.filter((m) => m.tipo === 'compra').length}
            </Text>
            <Text style={styles.statLabel}>Compras</Text>
          </Card>
          <Card variant="outlined" padding="none" style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientos.filter((m) => m.tipo === 'recarga').length}
            </Text>
            <Text style={styles.statLabel}>Recargas</Text>
          </Card>
        </Animated.View>

        {/* ─── Historial de Movimientos (animado) ──────────── */}
        <Animated.View
          style={[
            styles.section,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.sectionTitle}>Últimos movimientos</Text>

          {movimientos.length === 0 ? (
            <Card variant="outlined" padding="none" style={styles.emptyMovimientos}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>Sin movimientos todavía</Text>
              <Text style={styles.emptyDescription}>
                Tus recargas y compras aparecerán aquí para que lleves el control de tu saldo.
              </Text>
            </Card>
          ) : (
            movimientos.map((mov, index) => (
              <MovimientoItem key={mov.id} mov={mov} index={index} />
            ))
          )}

          <Text style={styles.footerText}>
            Las recargas y movimientos se sincronizan con tu cuenta Supabase.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ─── Selector de Monto ───────────────────────────────── */}
      <Modal
        visible={montoSeleccionado > 0 && !recargaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMontoSeleccionado(0)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona el monto</Text>
              <TouchableOpacity onPress={() => setMontoSeleccionado(0)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalQuickLabel}>Montos rápidos</Text>
            <View style={styles.quickAmountsRow}>
              {SALDOS_RAPIDOS.map((monto) => (
                <TouchableOpacity
                  key={monto}
                  style={styles.quickAmountBtn}
                  onPress={() => {
                    setMontoSeleccionado(monto);
                    setRecargaVisible(true);
                  }}
                >
                  <Text style={styles.quickAmountText}>{formatCLP(monto)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>O ingresa un monto personalizado</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="$0"
              keyboardType="numeric"
              value={montoRecarga}
              onChangeText={setMontoRecarga}
              autoFocus
            />

            <Button
              title="Continuar"
              onPress={() => {
                const monto = parseInt(montoRecarga, 10);
                if (!isNaN(monto) && monto > 0) {
                  setMontoSeleccionado(monto);
                  setRecargaVisible(true);
                }
              }}
              disabled={!montoRecarga}
              style={[
                styles.confirmButton,
                !montoRecarga && styles.confirmButtonDisabled,
              ]}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal de Recarga con Tarjeta Simulada ──────────── */}
      <Modal
        visible={recargaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !procesandoRecarga && setRecargaVisible(false)}
      >
        <PaymentScreen
          monto={montoSeleccionado}
          onPagoExitoso={(monto) => {
            handleRecarga(monto);
            setRecargaVisible(false);
            setMontoSeleccionado(0);
          }}
          onCancelar={() => {
            if (!procesandoRecarga) {
              setRecargaVisible(false);
              setMontoSeleccionado(0);
            }
          }}
        />
      </Modal>
    </View>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  header: {
    height: 72,
    backgroundColor: colors.blanco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  headerTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoMedio as '600',
    color: colors.cafeOscuro,
  },
  refreshIcon: {
    fontSize: 24,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoBold as '700',
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
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textoSecundario,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 30,
  },

  // ─── Tarjeta de Saldo ───────────────────────────────────────
  balanceCard: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 28,
    padding: 3,
    shadowColor: colors.cafeOscuro,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceCardInner: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 25,
    padding: spacing.xxl,
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
    color: colors.dorado,
    fontSize: 11,
    fontWeight: typography.pesoBold as '700',
    letterSpacing: 1.2,
  },
  balanceValue: {
    color: colors.blanco,
    fontSize: 42,
    fontWeight: typography.pesoExtraBold as '800',
    fontFamily: typography.familia,
    marginTop: spacing.sm,
  },
  balanceHint: {
    color: colors.bordeOscuro,
    fontSize: typography.cuerpoPequeno,
    marginTop: 6,
  },

  // ─── Botones de Acción ──────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.blanco,
    borderRadius: 18,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
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
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionIconAlt: {
    backgroundColor: colors.crema,
  },
  actionIcon: {
    color: colors.blanco,
    fontSize: 18,
    fontWeight: typography.pesoExtraBold as '800',
  },
  actionText: {
    fontSize: 13,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
  },

  // ─── Estadísticas ───────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.doradoBg,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  statValue: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoExtraBold as '800',
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
  },
  statLabel: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
    marginTop: 2,
    fontWeight: typography.pesoMedio as '600',
  },

  // ─── Sección de Movimientos ────────────────────────────────
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
    marginBottom: spacing.md,
  },

  // ─── Movimiento Card ───────────────────────────────────────
  movimientoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borde,
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
    fontWeight: typography.pesoExtraBold as '800',
    color: colors.cafeOscuro,
  },
  movimientoInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  movimientoName: {
    fontSize: 13,
    fontWeight: typography.pesoMedio as '600',
    color: colors.cafeOscuro,
  },
  movimientoMeta: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
    marginTop: 2,
  },
  movimientoAmount: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoExtraBold as '800',
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

  // ─── Empty State ────────────────────────────────────────────
  emptyMovimientos: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.crema,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borde,
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
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  footerText: {
    textAlign: 'center',
    fontSize: typography.etiqueta,
    color: colors.textoDeshabilitado,
    marginTop: spacing.md,
  },

  // ─── Modal ──────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xxl,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: typography.pesoExtraBold as '800',
    color: colors.cafeOscuro,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textoSecundario,
    fontWeight: typography.pesoBold as '700',
    padding: spacing.xs,
  },
  modalLabel: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold as '700',
    color: colors.textoSecundario,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: colors.fondo,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
    borderWidth: 2,
    borderColor: colors.borde,
  },
  modalQuickLabel: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold as '700',
    color: colors.textoSecundario,
    marginTop: spacing.xl,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.xxl,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: colors.doradoBg,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
  },
  confirmButton: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.cafeOscuro,
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
    color: colors.blanco,
    fontSize: 15,
    fontWeight: typography.pesoExtraBold as '800',
  },
});

export default WalletScreen;
