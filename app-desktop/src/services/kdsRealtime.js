import { supabase, isSupabaseConfigured } from './supabaseClient';
import { normalizarPedido } from './pedidosService';

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
      codigo_pedido: nuevoPedido.codigo_pedido,
      codigo_retiro_diario: nuevoPedido.codigo_retiro_diario,
      qr_token: nuevoPedido.qr_token,
      cafeteria_id: nuevoPedido.cafeteria_id,
      cafeterias: nuevoPedido.cafeterias,
      franja_retiro: nuevoPedido.franja_retiro,
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
    // cualquiera de ellas. Filtrar dejaba pedidos pagados pero invisibles, que es
    // justo el fallo de "hice un pedido y no aparece en el KDS". Cada tarjeta
    // muestra el nombre de la cafeteria para no confundirlos.
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
          .select('nombre')
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
        // Refleja en tiempo real los cambios de estado (pendiente -> en_preparacion -> listo),
        // enriqueciendo con sus detalles para que la comanda nunca pierda los productos.
        const comanda = await construirComanda(fila);
        onActualizar?.(comanda || normalizarPedido(fila));
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
