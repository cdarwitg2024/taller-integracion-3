import { supabase, isSupabaseConfigured } from './supabaseClient';
import { normalizarPedido } from './pedidosService';

const CAFETERIA_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CAFETERIA_ID)
  ? Number(import.meta.env.VITE_CAFETERIA_ID)
  : 1;

export const ESTADO_CONECTADO = 'conectado';
export const ESTADO_RECONECTANDO = 'reconectando';
export const ESTADO_INDISPONIBLE = 'indisponible';

async function construirComanda(nuevoPedido) {
  try {
    const { data: detalles, error } = await supabase
      .from('DETALLES_PEDIDO')
      .select('cantidad, modificaciones, PRODUCTOS(nombre)')
      .eq('pedido_id', nuevoPedido.id);

    if (error) return null;

    return normalizarPedido({
      id: nuevoPedido.id,
      qr_token: nuevoPedido.qr_token,
      estado: nuevoPedido.estado,
      total: nuevoPedido.total,
      creado_en: nuevoPedido.creado_en,
      hora_retiro: nuevoPedido.hora_retiro,
      DETALLES_PEDIDO: detalles || [],
    });
  } catch {
    return null;
  }
}

export const kdsRealtime = {
  suscribir({ cafeteriaId = CAFETERIA_ID, onComanda, onEstadoCanal }) {
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
        table: 'PEDIDOS',
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