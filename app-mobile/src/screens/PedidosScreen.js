import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';

import { supabase } from '../lib/supabase';
import QrCode from '../lib/QrCode';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: colors.naranja, bg: colors.naranjaBg },
  preparando: { label: 'En preparación', color: colors.naranja, bg: colors.rojoBg },
  en_preparacion: { label: 'En preparación', color: colors.naranja, bg: colors.rojoBg },
  listo: { label: 'Listo para retiro', color: colors.verde, bg: colors.verdeBg },
  entregado: { label: 'Entregado', color: colors.cafeOscuro, bg: colors.borde },
  cancelado: { label: 'Cancelado', color: colors.rojo, bg: colors.rojoBg },
};

const fallbackOrders = [
  {
    id: 'demo-1',
    codigo_pedido: '1264-D',
    cafeteria_nombre: 'Cafetería Central',
    total: 6200,
    estado: 'pendiente',
    creado_en: new Date().toISOString(),
    detalles: [],
    isPlaceholder: true,
  },
  {
    id: 'demo-2',
    codigo_pedido: '0912-K',
    cafeteria_nombre: 'Cafetería Biblioteca',
    total: 3600,
    estado: 'entregado',
    creado_en: new Date(Date.now() - 86400000).toISOString(),
    detalles: [],
    isPlaceholder: true,
  },
];

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Suma las unidades pedidas, no la cantidad de filas: 2 lineas de 3 cafe y
// 1 linea de 1 agua son 4 unidades y no 3.
const totalItems = (detalles = []) =>
  (detalles || []).reduce((suma, d) => suma + (Number(d.cantidad) || 0), 0);

const mapPedido = (p) => ({
  id: String(p.id),
  qr_token: p.qr_token || null,
  // `codigo_pedido` es lo unico que se muestra como nombre del pedido y NO
  // sirve para retirarlo. El token de contingencia se muestra aparte, como
  // codigo de respaldo, para el caso en que el QR no se pueda escanear.
  codigo_pedido: p.codigo_pedido || `#${p.id}`,
  codigo_retiro_diario: p.codigo_retiro_diario || null,
  franja_retiro: p.franja_retiro || null,
  cafeteria_nombre: p.cafeterias?.nombre || 'Cafetería',
  total: Number(p.total) || 0,
  estado: p.estado === 'preparando' ? 'en_preparacion' : p.estado || 'pendiente',
  creado_en: p.creado_en,
  // Se usa para el recibo: si el pedido ya fue retirado, el QR deja de tener
  // sentido y en su lugar se muestra el detalle de lo que se compro y cuando.
  entregado_en: p.entregado_en || null,
  detalles: (p.detalles_pedido || []).map((d) => ({
    nombre: d.productos?.nombre || 'Producto',
    cantidad: Number(d.cantidad) || 1,
    precio: Number(d.productos?.precio) || 0,
  })),
});

// URL del backend Node. Viene de EXPO_PUBLIC_API_URL (ver app-mobile/.env).
// En un teléfono físico debe ser la IP de la PC, no 127.0.0.1.
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

// Pide el QR al backend, que es quien lo dibuja y lo registra. Si el backend no
// responde (teléfono sin red contra la PC, API apagada) se degrada al QR local
// con el token crudo, que el KDS también acepta.
const obtenerQrDesdeBackend = async (pedidoId) => {
  if (!API_URL) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_URL}/api/pedidos/${pedidoId}/qr`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success && json?.data ? json.data : null;
  } catch (e) {
    return null;
  }
};

const PedidosScreen = ({ userId, onGoToCafeterias, pedidoConfirmado, onConfirmacionVista }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [qrBackend, setQrBackend] = useState(null);
  // Guarda qué pedido está abierto: si la respuesta del backend llega tarde,
  // no debe pintar el QR de un pedido que el estudiante ya cerró.
  const pedidoAbierto = useRef(null);

  const cerrarPedido = useCallback(() => {
    pedidoAbierto.current = null;
    setSelected(null);
    setQrBackend(null);
  }, []);

  // Al abrir un pedido se pide su QR al backend. `qrBackend` es null mientras
  // carga, y queda null si la API no respondió (se usa el QR local).
  // Un pedido ya entregado no pide QR: se muestra el recibo en su lugar.
  const abrirPedido = useCallback(async (item) => {
    pedidoAbierto.current = item.id;
    setSelected(item);
    setQrBackend(null);
    if (!item.qr_token || item.estado === 'entregado') return;
    const data = await obtenerQrDesdeBackend(item.id);
    if (pedidoAbierto.current !== item.id) return;
    setQrBackend(data);
  }, []);

  const aplicarOrden = useCallback((nuevos) => {
    setOrders(nuevos.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)));
  }, []);

  const obtenerUsuarioId = useCallback(async () => {
    if (!userId) return null;
    // `userId` es el UUID de Supabase Auth, pero `pedidos.usuario_id` es el
    // id interno de `usuarios` (BIGINT). Hay que pasar por `usuarios` para
    // traducir: la columna `pedidos.auth_user_id` no existe en el esquema.
    const { data, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }, [userId]);

  const fetchOrders = useCallback(async () => {
    // Solo el modo invitado ve pedidos de ejemplo. Un usuario autenticado sin
    // pedidos ve la lista vacia: mostrarle mockups lo hace creer que sus
    // compras no se guardaron.
    if (!userId) {
      aplicarOrden(fallbackOrders);
      setLoading(false);
      return;
    }

    try {
      const usuarioId = await obtenerUsuarioId();

      if (!usuarioId) {
        console.warn('La sesion no tiene usuario interno asociado.');
        aplicarOrden([]);
        return;
      }

      const { data, error } = await supabase
        .from('pedidos')
        .select('*, cafeterias(nombre), detalles_pedido(productos(nombre, precio), cantidad)')
        .eq('usuario_id', usuarioId)
        .order('creado_en', { ascending: false });

      if (error) throw error;

      aplicarOrden((data || []).map(mapPedido));
    } catch (err) {
      console.warn('No se pudieron cargar los pedidos:', err);
      aplicarOrden([]);
    } finally {
      setLoading(false);
    }
  }, [userId, obtenerUsuarioId, aplicarOrden]);

  useEffect(() => {
    let mounted = true;
    if (mounted) setLoading(true);
    fetchOrders();
    return () => {
      mounted = false;
    };
  }, [fetchOrders]);

  useEffect(() => {
    if (!userId) return undefined;
    let canal = null;
    let cancelado = false;

    // El filtro de Realtime compara contra `usuario_id`, que es el id interno
    // (BIGINT), no el UUID de Auth. Con el UUID el canal se suscribia sin
    // filtro util y el movil no recibia las actualizaciones de sus pedidos.
    obtenerUsuarioId()
      .then((usuarioId) => {
        if (cancelado) return;
        if (!usuarioId) {
          console.warn('Realtime desactivado: la sesion no tiene usuario interno.');
          return;
        }

        canal = supabase
          .channel('mi-pedidos')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'pedidos',
              filter: `usuario_id=eq.${usuarioId}`,
            },
            (payload) => {
              const nuevo = payload.new;
              if (!nuevo) return;
              setOrders((prev) => {
                const idx = prev.findIndex((o) => o.id === String(nuevo.id));
                if (idx === -1) return prev;
                const siguiente = [...prev];
                siguiente[idx] = mapPedido(nuevo);
                return siguiente;
              });
              setSelected((prevSel) =>
                prevSel && String(prevSel.id) === String(nuevo.id)
                  ? mapPedido(nuevo)
                  : prevSel
              );
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'pedidos',
              filter: `usuario_id=eq.${usuarioId}`,
            },
            () => fetchOrders()
          )
          .subscribe();
      })
      .catch((err) => console.warn('No se pudo suscribir a Realtime:', err));

    return () => {
      cancelado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [userId, obtenerUsuarioId, fetchOrders]);

  const renderItem = ({ item }) => {
    const estado = ESTADOS[item.estado] || ESTADOS.pendiente;
    const detalles = item.detalles || [];
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.cardWrapper}
        onPress={() => abrirPedido(item)}
      >
        <Card variant="elevated" padding="lg">
        <View style={styles.cardTop}>
          <Text style={styles.cardCodigo}>{item.codigo_pedido}</Text>
          <View style={[styles.badge, { backgroundColor: estado.bg }]}>
            <Text style={[styles.badgeText, { color: estado.color }]}>{estado.label}</Text>
          </View>
        </View>

        <Text style={styles.cardCafeteria}>{item.cafeteria_nombre}</Text>

        <View style={styles.cardBottom}>
          <Text style={styles.cardDate}>{formatDate(item.creado_en)}</Text>
          <Text style={styles.cardTotal}>${item.total.toLocaleString('es-CL')}</Text>
        </View>

        {detalles.length > 0 && (
          <Text style={styles.cardDetalle} numberOfLines={1}>
            {detalles.map((d) => `${d.cantidad}× ${d.nombre}`).join(' · ')}
          </Text>
        )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Mis Pedidos"
        rightElement={
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        }
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.cafeOscuro} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Acá verás el estado de tus pedidos en tiempo real. Toca un pedido para ver su detalle y, si sigue disponible, el QR de retiro.
              </Text>
            </View>
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Aún no tienes pedidos</Text>
              <Text style={styles.emptyDescription}>
                Cuando hagas tu primer pedido aparecerá aquí con su estado y el código de retiro.
              </Text>
              <Button
                title="Ver cafeterías"
                onPress={onGoToCafeterias}
                size="md"
                style={{ marginTop: 18 }}
              />
            </View>
          }
        />
      )}

      {/* Modal de confirmación de pedido pagado (FR-21) */}
      <Modal
        visible={Boolean(pedidoConfirmado)}
        animationType="slide"
        transparent
        onRequestClose={onConfirmacionVista}
      >
        <View style={styles.modalBackdrop}>
          <Card variant="elevated" padding="lg" style={styles.modalCard}>
            {pedidoConfirmado && (
              <>
                <View style={styles.confirmacionHeader}>
                  <View style={styles.confirmacionIcono}>
                    <Text style={styles.confirmacionIconoTexto}>✓</Text>
                  </View>
                  <Text style={styles.confirmacionTitulo}>¡Pedido Confirmado!</Text>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={onConfirmacionVista}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.confirmacionInfo}>
                  <View style={styles.confirmacionFila}>
                    <Text style={styles.confirmacionLabel}>Pedido</Text>
                    <Text style={styles.confirmacionValor}>
                      #{pedidoConfirmado.pedido_id}
                    </Text>
                  </View>
                  <View style={styles.confirmacionFila}>
                    <Text style={styles.confirmacionLabel}>Total pagado</Text>
                    <Text style={styles.confirmacionValor}>
                      ${pedidoConfirmado.total.toLocaleString('es-CL')}
                    </Text>
                  </View>
                  <View style={styles.confirmacionFila}>
                    <Text style={styles.confirmacionLabel}>Saldo restante</Text>
                    <Text style={styles.confirmacionValor}>
                      ${pedidoConfirmado.saldo_restante.toLocaleString('es-CL')}
                    </Text>
                  </View>
                  {pedidoConfirmado.franja_retiro && (
                    <View style={styles.confirmacionFila}>
                      <Text style={styles.confirmacionLabel}>Franja de retiro</Text>
                      <Text style={styles.confirmacionValor}>
                        {pedidoConfirmado.franja_retiro}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.confirmacionQrSection}>
                  <Text style={styles.confirmacionQrTitulo}>
                    Tu QR de retiro
                  </Text>
                  <Text style={styles.confirmacionQrHint}>
                    Presenta este código al llegar a la cafetería
                  </Text>
                  <View style={styles.confirmacionQrBox}>
                    <Text style={styles.confirmacionQrTexto}>
                      {pedidoConfirmado.qr_token
                        ? `QR-${pedidoConfirmado.qr_token.substring(0, 8).toUpperCase()}`
                        : `QR-${pedidoConfirmado.pedido_id.toString().padStart(6, '0')}`}
                    </Text>
                  </View>
                  <Text style={styles.confirmacionTokenTexto}>
                    Token de contingencia: {pedidoConfirmado.codigo_retiro || `CF-${pedidoConfirmado.pedido_id.toString().padStart(4, '0')}`}
                  </Text>
                </View>

                <Button
                  title="Ver mis pedidos"
                  onPress={onConfirmacionVista}
                  size="lg"
                />
              </>
            )}
          </Card>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        transparent
        onRequestClose={cerrarPedido}
      >
        <View style={styles.modalBackdrop}>
          <Card variant="elevated" padding="lg" style={styles.modalCard}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalCodigo}>
                      Pedido {selected.codigo_pedido}
                    </Text>
                    <Text style={styles.modalCafeteria}>{selected.cafeteria_nombre}</Text>
                    {selected.franja_retiro ? (
                      <Text style={styles.modalFranja}>
                        Retiro: {selected.franja_retiro}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={cerrarPedido}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detalleLista}>
                  {(selected.detalles || []).map((d, idx) => (
                    <View key={idx} style={styles.detalleRow}>
                      <Text style={styles.detalleNombre}>
                        {d.cantidad}× {d.nombre}
                      </Text>
                      <Text style={styles.detallePrecio}>
                        ${(d.cantidad * d.precio).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.detalleDivider} />
                  <View style={styles.detalleRow}>
                    <Text style={styles.detalleTotal}>Total</Text>
                    <Text style={styles.detalleTotal}>${selected.total.toLocaleString('es-CL')}</Text>
                  </View>
                </View>

                {selected.estado === 'entregado' ? (
                  /* Pedido ya retirado: el QR y el token de contingencia ya no
                     sirven para nada y ademas son una credencial que conviene
                     dejar de exponer. En su lugar se muestra el recibo. */
                  <View style={styles.reciboBox}>
                    <Text style={styles.reciboTitulo}>✓ Pedido entregado</Text>
                    <Text style={styles.reciboSubtitulo}>
                      {selected.entregado_en
                        ? `Retirado el ${formatDate(selected.entregado_en)}.`
                        : 'Este pedido ya fue retirado de la cafetería.'}
                    </Text>

                    <View style={styles.reciboDivider} />

                    <View style={styles.detalleRow}>
                      <Text style={styles.reciboLabel}>Pedido</Text>
                      <Text style={styles.reciboValor}>{selected.codigo_pedido}</Text>
                    </View>
                    <View style={styles.detalleRow}>
                      <Text style={styles.reciboLabel}>Fecha del pedido</Text>
                      <Text style={styles.reciboValor}>
                        {formatDate(selected.creado_en)}
                      </Text>
                    </View>
                    <View style={styles.detalleRow}>
                      <Text style={styles.reciboLabel}>Productos</Text>
                      <Text style={styles.reciboValor}>
                        {totalItems(selected.detalles)}{' '}
                        {totalItems(selected.detalles) === 1 ? 'producto' : 'productos'}
                      </Text>
                    </View>
                    <View style={styles.detalleRow}>
                      <Text style={styles.reciboLabel}>Retiro</Text>
                      <Text style={styles.reciboValor}>
                        {selected.franja_retiro || 'sin franja'}
                      </Text>
                    </View>

                    <View style={styles.reciboDivider} />

                    <View style={styles.detalleRow}>
                      <Text style={styles.detalleTotal}>Total pagado</Text>
                      <Text style={styles.detalleTotal}>
                        ${selected.total.toLocaleString('es-CL')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.qrContainer}>
                    {selected.qr_token ? (
                      <>
                        {/* El backend genera la imagen y el contenido va en JSON;
                            si la API no responde se cae al QR local con el token
                            crudo, que el KDS también acepta. */}
                        {qrBackend?.qr_image ? (
                          <Image
                            source={{ uri: qrBackend.qr_image }}
                            style={styles.qrImagen}
                            resizeMode="contain"
                          />
                        ) : (
                          <QrCode value={selected.qr_token} size={190} />
                        )}
                        <Text style={styles.qrHint}>
                          Presenta este QR al llegar a la cafetería para retirar tu pedido.
                        </Text>
                        <View style={styles.contingenciaBox}>
                          <Text style={styles.contingenciaTitulo}>
                            ¿No puedes escanear? Di este código
                          </Text>
                          <Text style={styles.contingenciaCodigo}>
                            {qrBackend?.codigo_legible || selected.codigo_retiro_diario}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.qrHint}>
                        El QR de retiro aparecerá aquí una vez confirmado el pago de tu pedido.
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </Card>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  cardWrapper: { marginBottom: spacing.md },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: { color: colors.blanco },
  list: { padding: spacing.lg, paddingBottom: 25 },
  infoBanner: {
    backgroundColor: colors.crema,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
  },
  infoBannerText: {
    textAlign: 'center',
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCodigo: { fontSize: typography.cuerpo, fontWeight: typography.pesoExtraBold, color: colors.cafeOscuro },
  badge: { paddingHorizontal: 10, paddingVertical: spacing.xs, borderRadius: 12 },
  badgeText: { fontSize: typography.etiqueta, fontWeight: typography.pesoBold },
  cardCafeteria: { fontSize: typography.cuerpoPequeno, color: colors.textoSecundario, marginTop: 6 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cardDate: { fontSize: typography.etiqueta, color: colors.textoDeshabilitado },
  cardTotal: { fontSize: 15, fontWeight: typography.pesoExtraBold, color: colors.cafeOscuro },
  cardDetalle: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
    paddingTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.crema,
    borderRadius: 24,
    marginTop: spacing.sm,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.subtitulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro, textAlign: 'center' },
  emptyDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCodigo: { fontSize: 17, fontWeight: typography.pesoExtraBold, color: colors.cafeOscuro },
  modalCafeteria: { fontSize: typography.cuerpoPequeno, color: colors.textoSecundario, marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borde,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { color: colors.cafeOscuro, fontWeight: typography.pesoExtraBold },
  detalleLista: { marginTop: 18, backgroundColor: colors.fondo, borderRadius: 16, padding: 14 },
  detalleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detalleNombre: { fontSize: typography.cuerpoPequeno, color: colors.cafeOscuro },
  detallePrecio: { fontSize: typography.cuerpoPequeno, fontWeight: typography.pesoMedio, color: colors.cafeOscuro },
  detalleDivider: { height: 1, backgroundColor: colors.borde, marginVertical: 7 },
  detalleTotal: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  qrContainer: { alignItems: 'center', marginTop: spacing.xl },
  qrImagen: { width: 200, height: 200 },
  qrHint: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  contingenciaBox: {
    marginTop: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.crema,
    alignItems: 'center',
    width: '100%',
  },
  contingenciaTitulo: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
  },
  contingenciaCodigo: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    letterSpacing: 3,
  },
  modalFranja: {
    marginTop: spacing.xs,
    fontSize: typography.cuerpoPequeno,
    color: colors.verde,
    fontWeight: typography.pesoMedio,
  },
  reciboBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.verdeBg,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  reciboTitulo: { fontSize: 15, fontWeight: typography.pesoExtraBold, color: colors.verde },
  reciboSubtitulo: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  reciboDivider: {
    height: 1,
    backgroundColor: colors.bordeOscuro,
    marginVertical: 11,
  },
  reciboLabel: { fontSize: typography.cuerpoPequeno, color: colors.textoSecundario, flex: 1 },
  reciboValor: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    textAlign: 'right',
  },

  // ─── Confirmación de Pedido (FR-21) ─────────────────────────
  confirmacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  confirmacionIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.verdeBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  confirmacionIconoTexto: {
    fontSize: 20,
    fontWeight: typography.pesoExtraBold,
    color: colors.verde,
  },
  confirmacionTitulo: {
    flex: 1,
    fontSize: 18,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  confirmacionInfo: {
    backgroundColor: colors.fondo,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  confirmacionFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  confirmacionLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  confirmacionValor: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  confirmacionQrSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  confirmacionQrTitulo: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: spacing.xs,
  },
  confirmacionQrHint: {
    fontSize: 11,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmacionQrBox: {
    backgroundColor: colors.blanco,
    borderWidth: 2,
    borderColor: colors.cafeOscuro,
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
  },
  confirmacionQrTexto: {
    fontSize: 24,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    letterSpacing: 2,
  },
  confirmacionTokenTexto: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
  },
});

export default PedidosScreen;