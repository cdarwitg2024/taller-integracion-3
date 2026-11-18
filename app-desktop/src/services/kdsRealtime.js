import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { normalizarPedido } from './pedidosService';

export const ESTADO_CONECTADO = 'conectado';
export const ESTADO_RECONECTANDO = 'reconectando';
export const ESTADO_INDISPONIBLE = 'indisponible';

async function construirComanda(nuevoPedido) {
  try {
    let { data: detalles, error } = await supabase
      .from('detalles_pedido')
      .select('*, productos(*)')
      .eq('pedido_id', nuevoPedido.id);

    // Si la lectura inicial no encontró ítems (por carrera entre la inserción del pedido y sus detalles),
    // se realiza un reintento breve para no perder los productos de la comanda
    if (error || !detalles || detalles.length === 0) {
      await new Promise((r) => setTimeout(r, 350));
      const retry = await supabase
        .from('detalles_pedido')
        .select('*, productos(*)')
        .eq('pedido_id', nuevoPedido.id);
      if (!retry.error && retry.data && retry.data.length > 0) {
        detalles = retry.data;
      }
    }

    return normalizarPedido({
      ...nuevoPedido,
      detalles_pedido: detalles || [],
    });
  } catch {
    return null;
  }
}

export const kdsRealtime = {
  suscribir({
    onComanda,
    onActualizar,
    onEstadoCanal,
    cafeteriaId,
  } = {}) {
    let activo = true;
    if (!isSupabaseConfigured) {
      onEstadoCanal?.(ESTADO_INDISPONIBLE);
      return { cerrar() {} };
    }

    const cid = typeof cafeteriaId === 'number' || typeof cafeteriaId === 'string'
      ? Number(cafeteriaId)
      : null;
    if (!Number.isSafeInteger(cid) || cid <= 0) {
      onEstadoCanal?.(ESTADO_INDISPONIBLE);
      return { cerrar() {} };
    }

    const vistos = new Set();
    const canal = supabase.channel(`kds-pedidos-${cid}`);

    canal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pedidos',
      },
      async (payload) => {
        if (!activo) return;
        const nuevo = payload?.new;
        if (!nuevo || nuevo.estado !== 'pendiente') return;
        if (Number(nuevo.cafeteria_id) !== cid) return;
        if (vistos.has(String(nuevo.id))) return;
        vistos.add(String(nuevo.id));

        const { data: cafe } = await supabase
          .from('cafeterias')
          .select('*')
          .eq('id', nuevo.cafeteria_id)
          .maybeSingle();
        if (!activo) return;

        const comanda = await construirComanda({ ...nuevo, cafeterias: cafe || null });
        if (activo && comanda) onComanda?.(comanda);
      }
    );

    canal.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
      },
      async (payload) => {
        if (!activo) return;
        const fila = payload?.new;
        if (!fila) return;
        if (Number(fila.cafeteria_id) !== cid) return;
        const { data: cafe } = await supabase
          .from('cafeterias')
          .select('*')
          .eq('id', fila.cafeteria_id)
          .maybeSingle();
        if (!activo) return;

        // Refleja en tiempo real los cambios de estado (pendiente -> en_preparacion -> listo),
        // enriqueciendo con sus detalles para que la comanda nunca pierda los productos ni los precios.
        const comanda = await construirComanda({ ...fila, cafeterias: cafe || null });
        if (!activo) return;
        onActualizar?.(comanda || normalizarPedido({ ...fila, cafeterias: cafe || null }));
      }
    );

    canal.subscribe((status) => {
      if (!activo) return;
      if (status === 'SUBSCRIBED') {
        onEstadoCanal?.(ESTADO_CONECTADO);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onEstadoCanal?.(ESTADO_RECONECTANDO);
      }
    });

    return {
      canal,
      cerrar() {
        activo = false;
        canal.unsubscribe();
        supabase.removeChannel(canal);
      },
    };
  },
};

export default kdsRealtime;
