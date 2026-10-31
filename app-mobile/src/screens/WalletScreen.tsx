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
import MovimientoItem, { Movimiento } from './MovimientoItem';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  type RecargaPendiente,
  depurarRecargasPendientes,
  reconciliarMovimientos,
} from '../utils/walletReconciliation';

// ─── Tipos ───────────────────────────────────────────────────────
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
  const [errorMovimientos, setErrorMovimientos] = useState<string | null>(null);
  const [recargaVisible, setRecargaVisible] = useState(false);
  const [montoRecarga, setMontoRecarga] = useState('');
  const [procesandoRecarga, setProcesandoRecarga] = useState(false);
  const [montoSeleccionado, setMontoSeleccionado] = useState(0);
  const [saldoMostrado, setSaldoMostrado] = useState(0);
  // S2-T16: recargas optimistas que todavía no están confirmadas en la base.
  // Se muestran arriba de los movimientos y se retiran al confirmarse o fallar.
  const [recargasPendientes, setRecargasPendientes] = useState<
    RecargaPendiente[]
  >([]);
  // Último `wallet` confirmado, para fijar el saldo final fuera del closure.
  const walletRef = useRef<Wallet | null>(null);
  // Evita que un refetch de Realtime "salte" el contador mientras anima.
  const animandoSaldoRef = useRef(false);

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

  // ─── Cargar saldo y movimientos de forma segura ────────────────
  const cargarSaldo = useCallback(async () => {
    try {
      setErrorMovimientos(null);

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

      // Cargar o crear wallet del usuario autenticado
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
        } else if (createError) {
          throw createError;
        }
      } else if (walletError) {
        throw walletError;
      }

      setWallet(walletData as Wallet | null);

      // Cargar movimientos pertenecientes de forma estricta a la wallet del usuario
      if (walletData) {
        const { data: movs, error: movsError } = await supabase
          .from('movimientos_wallet')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('creado_en', { ascending: false })
          .limit(20);

        if (movsError) {
          console.error('[WalletScreen] Error al consultar movimientos:', movsError);
          setErrorMovimientos(
            'No se pudieron cargar tus movimientos de forma segura. Por favor, reintenta.'
          );
        } else if (movs) {
          const confirmados = movs as Movimiento[];
          setMovimientos(confirmados);
          // S2-T16: si el movimiento real ya está en la base, la recarga
          // temporal deja de mostrarse para no duplicar la recarga.
          setRecargasPendientes((prev) =>
            depurarRecargasPendientes(prev, confirmados)
          );
        }
      }
    } catch (err) {
      console.warn('[WalletScreen] Error cargando saldo o movimientos:', err);
      setErrorMovimientos('Ocurrió un problema de conexión al consultar tus movimientos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, obtenerUsuarioId]);

  useEffect(() => {
    cargarSaldo();
  }, [cargarSaldo]);

  // S2-T16: el contador del saldo sigue el valor interpolado de la animación.
  // El saldo final, al terminar, se toma del estado confirmado (wallet).
  useEffect(() => {
    const listenerId = saldoInterpolado.addListener(({ value }) => {
      setSaldoMostrado(Math.round(value));
    });

    return () => {
      saldoInterpolado.removeListener(listenerId);
    };
  }, [saldoInterpolado]);

  // S2-T16: `wallet.saldo_actual` es el saldo confirmado por la base. Se
  // refleja en pantalla salvo mientras corre la animación de una recarga.
  useEffect(() => {
    walletRef.current = wallet;
    if (!wallet || animandoSaldoRef.current) return;
    setSaldoMostrado(wallet.saldo_actual);
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
  /**
   * S2-T16: retira una recarga optimista.
   *
   * Se usa cuando la RPC falla o devuelve `ok: false`: el movimiento temporal
   * no debe quedar como si la recarga hubiera sido confirmada.
   */
  const descartarRecargaPendiente = (id: string) => {
    setRecargasPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  /**
   * S2-T16: anima el contador del saldo hasta el valor devuelto por la RPC.
   * El valor final se fija con `wallet.saldo_actual` (estado confirmado).
   */
  const animarSaldoConfirmado = (destino: number | null) => {
    const desde = walletRef.current?.saldo_actual ?? saldoMostrado;
    const objetivo = destino ?? desde;

    if (objetivo === desde) {
      setSaldoMostrado(desde);
      return;
    }

    animandoSaldoRef.current = true;
    saldoInterpolado.setValue(desde);

    Animated.timing(saldoInterpolado, {
      toValue: objetivo,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      animandoSaldoRef.current = false;
      // El saldo final sale del estado confirmado: si el refetch ya actualizó
      // la wallet se usa ese valor; si todavía no llegó, el `saldo_nuevo` que
      // devolvió la RPC (leído de la base, nunca calculado en el cliente).
      const confirmado = walletRef.current?.saldo_actual;
      setSaldoMostrado(
        typeof confirmado === 'number' && confirmado !== desde
          ? confirmado
          : objetivo
      );
    });
  };

  const handleRecarga = async (monto: number) => {
    if (!wallet || monto <= 0 || procesandoRecarga) return;

    // Movimiento temporal visible mientras la RPC responde. Realtime puede
    // insertar el movimiento real antes o después; la reconciliación evita
    // que ambos queden visibles a la vez.
    const pendiente: RecargaPendiente = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      monto,
      iniciadaEn: Date.now(),
      descripcion: 'Recarga de saldo',
    };

    setRecargasPendientes((prev) => [pendiente, ...prev]);
    setProcesandoRecarga(true);

    try {
      // El saldo NO se actualiza con un UPDATE desde el cliente: la politica
      // `wallets_update_own` no existe a proposito, para que nadie se ponga un
      // saldo arbitrario. Ese UPDATE fallaba en silencio (RLS -> 0 filas ->
      // HTTP 204), la app sumaba en pantalla y al refrescar volvia el saldo
      // viejo. La recarga va por la RPC `recargar_saldo`, que suma, deja el
      // movimiento y devuelve el saldo real leido de la base.
      const { data, error } = await supabase.rpc('recargar_saldo', {
        p_monto: monto,
      });

      if (error) throw error;

      const res = data as {
        ok: boolean;
        motivo?: string;
        mensaje?: string;
        saldo_nuevo?: number;
      } | null;

      if (!res?.ok) {
        // Recarga rechazada: no queda ningún movimiento "confirmado".
        descartarRecargaPendiente(pendiente.id);
        Alert.alert('No se pudo recargar', res?.mensaje || 'Intenta nuevamente.');
        return;
      }

      // `saldo_nuevo` lo devuelve la RPC (no se calcula en el cliente) y se
      // usa solo como destino de la animación.
      animarSaldoConfirmado(
        typeof res.saldo_nuevo === 'number' ? res.saldo_nuevo : null
      );

      // Refresco autoritativo: wallet + movimientos reales. Deja el saldo y
      // el historial en el estado confirmado por la base.
      await cargarSaldo();

      setRecargaVisible(false);
      setMontoRecarga('');
      setMontoSeleccionado(0);
    } catch (err) {
      // La recarga no se confirmó: se elimina el movimiento temporal.
      descartarRecargaPendiente(pendiente.id);
      // El estado final debe ser el confirmado por la base: si la recarga
      // alcanzó a registrarse antes del error, el refetch la muestra; si no,
      // no queda nada visible como confirmado.
      await cargarSaldo();
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

  // S2-T16: lista visible = recargas pendientes no confirmadas + movimientos
  // confirmados por la base. Evita el duplicado temporal/real.
  const movimientosVisibles = reconciliarMovimientos(
    movimientos,
    recargasPendientes
  );

  // El saldo en pantalla es el animado; su valor final sale del estado
  // confirmado (wallet recargada desde la base).
  const saldo = saldoMostrado;
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
            <Text style={styles.statValue}>{movimientosVisibles.length}</Text>
            <Text style={styles.statLabel}>Movimientos</Text>
          </Card>
          <Card variant="outlined" padding="none" style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientosVisibles.filter((m) => m.tipo === 'compra').length}
            </Text>
            <Text style={styles.statLabel}>Compras</Text>
          </Card>
          <Card variant="outlined" padding="none" style={styles.statCard}>
            <Text style={styles.statValue}>
              {movimientosVisibles.filter((m) => m.tipo === 'recarga').length}
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

          {errorMovimientos ? (
            <Card variant="outlined" padding="none" style={styles.errorMovimientos}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Error al cargar movimientos</Text>
              <Text style={styles.errorDescription}>{errorMovimientos}</Text>
              <Button
                title="Reintentar consulta"
                variant="secondary"
                size="sm"
                onPress={onRefresh}
                loading={refreshing}
                style={styles.retryButton}
              />
            </Card>
          ) : movimientosVisibles.length === 0 ? (
            <Card variant="outlined" padding="none" style={styles.emptyMovimientos}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>Sin movimientos todavía</Text>
              <Text style={styles.emptyDescription}>
                Tus recargas y compras aparecerán aquí para que lleves el control de tu saldo.
              </Text>
            </Card>
          ) : (
            movimientosVisibles.map((mov, index) => (
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

  // ─── Error State de Movimientos ──────────────────────────────
  errorMovimientos: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.crema,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.rojo,
  },
  errorEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: typography.pesoBold as '700',
    color: colors.cafeOscuro,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 12,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
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
