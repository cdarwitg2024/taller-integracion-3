import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { supabase } from '../lib/supabase';
import QrCode from '../lib/QrCode';

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: '#B58A29', bg: '#FBF3E0' },
  preparando: { label: 'En preparación', color: '#C96F3B', bg: '#FCEAE3' },
  en_preparacion: { label: 'En preparación', color: '#C96F3B', bg: '#FCEAE3' },
  listo: { label: 'Listo para retiro', color: '#5B8C51', bg: '#E8F3E4' },
  entregado: { label: 'Entregado', color: '#4A332C', bg: '#EFE7DD' },
  cancelado: { label: 'Cancelado', color: '#A92A2A', bg: '#F7E3E3' },
};

const fallbackOrders = [
  {
    id: 'demo-1',
    codigo_retiro_diario: '1264-D',
    cafeteria_nombre: 'Cafetería Central',
    total: 6200,
    estado: 'pendiente',
    creado_en: new Date().toISOString(),
    detalles: [],
    isPlaceholder: true,
  },
  {
    id: 'demo-2',
    codigo_retiro_diario: '0912-K',
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

const mapPedido = (p) => ({
  id: String(p.id),
  qr_token: p.qr_token || null,
  codigo_retiro_diario: p.codigo_retiro_diario || `#${p.id}`,
  cafeteria_nombre: p.cafeterias?.nombre || 'Cafetería',
  total: Number(p.total) || 0,
  estado: p.estado === 'preparando' ? 'en_preparacion' : p.estado || 'pendiente',
  creado_en: p.creado_en,
  detalles: (p.detalles_pedido || []).map((d) => ({
    nombre: d.productos?.nombre || 'Producto',
    cantidad: Number(d.cantidad) || 1,
    precio: Number(d.productos?.precio) || 0,
  })),
});

const PedidosScreen = ({ userId, onGoToCafeterias }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const aplicarOrden = useCallback((nuevos) => {
    setOrders(nuevos.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)));
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      if (!userId) {
        aplicarOrden(fallbackOrders);
        return;
      }

      const { data, error } = await supabase
        .from('pedidos')
        .select('*, cafeterias(nombre), detalles_pedido(productos(nombre, precio), cantidad)')
        .or(`auth_user_id.eq.${userId},usuario_id.eq.${userId}`)
        .order('creado_en', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        aplicarOrden(data.map(mapPedido));
      } else {
        aplicarOrden(fallbackOrders);
      }
    } catch (err) {
      console.warn('No se pudieron cargar los pedidos:', err);
      aplicarOrden(fallbackOrders);
    } finally {
      setLoading(false);
    }
  }, [userId, aplicarOrden]);

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

    const canal = supabase
      .channel('mi-pedidos')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `usuario_id=eq.${userId}`,
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
            prevSel && String(prevSel.id) === String(nuevo.id) ? mapPedido(nuevo) : prevSel
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId, fetchOrders]);

  const renderItem = ({ item }) => {
    const estado = ESTADOS[item.estado] || ESTADOS.pendiente;
    const detalles = item.detalles || [];
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => setSelected(item)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardCodigo}>{item.codigo_retiro_diario}</Text>
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <Text style={styles.headerTitle}>Mis Pedidos</Text>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>▣</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4A332C" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Acá verás el estado de tus pedidos en tiempo real. Toca un pedido para ver su detalle y el QR de retiro.
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
              <TouchableOpacity style={styles.emptyButton} onPress={onGoToCafeterias}>
                <Text style={styles.emptyButtonText}>Ver cafeterías</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalCodigo}>
                      Pedido {selected.codigo_retiro_diario}
                    </Text>
                    <Text style={styles.modalCafeteria}>{selected.cafeteria_nombre}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setSelected(null)}
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

                <View style={styles.qrContainer}>
                  {selected.qr_token ? (
                    <>
                      <QrCode value={selected.qr_token} size={190} />
                      <Text style={styles.qrHint}>
                        Presenta este QR al llegar a la cafetería para retirar tu pedido.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.qrHint}>
                      El QR de retiro aparecerá aquí una vez confirmado el pago de tu pedido.
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6F4' },
  header: {
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#4A332C' },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: '#4A332C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: { color: '#FFFFFF' },
  list: { padding: 16, paddingBottom: 25 },
  infoBanner: {
    backgroundColor: '#F5ECE5',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  infoBannerText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#4A332C',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCodigo: { fontSize: 14, fontWeight: '800', color: '#4A332C' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardCafeteria: { fontSize: 12, color: '#8A7B76', marginTop: 6 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cardDate: { fontSize: 10, color: '#A09590' },
  cardTotal: { fontSize: 15, fontWeight: '800', color: '#4A332C' },
  cardDetalle: {
    fontSize: 11,
    color: '#8A7B76',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EFEA',
    paddingTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#F9F3EC',
    borderRadius: 24,
    marginTop: 8,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#4A332C', textAlign: 'center' },
  emptyDescription: {
    fontSize: 12,
    color: '#958781',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 18,
    backgroundColor: '#4A332C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  emptyButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCodigo: { fontSize: 17, fontWeight: '800', color: '#4A332C' },
  modalCafeteria: { fontSize: 12, color: '#8A7B76', marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { color: '#4A332C', fontWeight: '800' },
  detalleLista: { marginTop: 18, backgroundColor: '#FBF8F4', borderRadius: 16, padding: 14 },
  detalleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detalleNombre: { fontSize: 12, color: '#4A332C' },
  detallePrecio: { fontSize: 12, fontWeight: '600', color: '#4A332C' },
  detalleDivider: { height: 1, backgroundColor: '#EFE7DD', marginVertical: 7 },
  detalleTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4A332C',
  },
  qrContainer: { alignItems: 'center', marginTop: 20 },
  qrHint: {
    fontSize: 12,
    color: '#8A7B76',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});

export default PedidosScreen;