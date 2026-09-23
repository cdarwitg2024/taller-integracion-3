import { supabase, isSupabaseConfigured } from './supabaseClient';
import { normalizarPedido } from './pedidosService';
import { CAFETERIA_ID } from './backendApi';

export const ESTADO_CONECTADO = 'conectado';
export const ESTADO_RECONECTANDO = 'reconectando';
export const ESTADO_INDISPONIBLE = 'indisponible';

async function construirComanda(nuevoPedido) {
  try {
    const { data: detalles, error } = await supabase
      .from('detalles_pedido')
      .select('cantidad, modificaciones, productos(nombre)')
      .eq('pedido_id', nuevoPedido.id);

    if (error) return null;

    return normalizarPedido({
      id: nuevoPedido.id,
      qr_token: nuevoPedido.qr_token,
      estado: nuevoPedido.estado,
      total: nuevoPedido.total,
      creado_en: nuevoPedido.creado_en,
      hora_retiro: nuevoPedido.hora_retiro,
      detalles_pedido: detalles || [],
    });
  } catch {
    return null;
  }
}

export const kdsRealtime = {
  suscribir({
    cafeteriaId = CAFETERIA_ID,
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

    canal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pedidos',
        filter: `cafeteria_id=eq.${cafeteriaId}`,
      },
      async (payload) => {
        const nuevo = payload?.new;
        if (!nuevo || nuevo.estado !== 'pendiente') return;
        if (vistos.has(String(nuevo.id))) return;
        vistos.add(String(nuevo.id));

        const comanda = await construirComanda(nuevo);
        if (comanda) onComanda?.(comanda);
      }
    );

    canal.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: `cafeteria_id=eq.${cafeteriaId}`,
      },
      (payload) => {
        const fila = payload?.new;
        if (!fila) return;
        // Refleja en tiempo real los cambios de estado (pendiente -> en_preparacion -> listo)
        onActualizar?.(normalizarPedido(fila));
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