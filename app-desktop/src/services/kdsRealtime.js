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
  }) {
    if (!isSupabaseConfigured) {
      onEstadoCanal?.(ESTADO_INDISPONIBLE);
      return { cerrar() {} };
    }

    const vistos = new Set();
    const canal = supabase.channel('kds-pedidos');

    // Sin filtro por cafeteria: hay un unico KDS y el estudiante puede pedir en
    // cualquiera de ellas. Cada tarjeta muestra el nombre de la cafeteria para no confundirlos.
    canal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pedidos',
      },
      async (payload) => {
        const nuevo = payload?.new;
        if (!nuevo || nuevo.estado !== 'pendiente') return;
        if (vistos.has(String(nuevo.id))) return;
        vistos.add(String(nuevo.id));

        const { data: cafe } = await supabase
          .from('cafeterias')
          .select('*')
          .eq('id', nuevo.cafeteria_id)
          .maybeSingle();

        const comanda = await construirComanda({ ...nuevo, cafeterias: cafe || null });
        if (comanda) onComanda?.(comanda);
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
        const fila = payload?.new;
        if (!fila) return;
        const { data: cafe } = await supabase
          .from('cafeterias')
          .select('*')
          .eq('id', fila.cafeteria_id)
          .maybeSingle();

        // Refleja en tiempo real los cambios de estado (pendiente -> en_preparacion -> listo),
        // enriqueciendo con sus detalles para que la comanda nunca pierda los productos ni los precios.
        const comanda = await construirComanda({ ...fila, cafeterias: cafe || null });
        onActualizar?.(comanda || normalizarPedido({ ...fila, cafeterias: cafe || null }));
      }
    );

    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onEstadoCanal?.(ESTADO_CONECTADO);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onEstadoCanal?.(ESTADO_RECONECTANDO);
      }
    });

    return {
      canal,
      cerrar() {
        canal.unsubscribe();
        supabase.removeChannel(canal);
      },
    };
  },
};

export default kdsRealtime;
