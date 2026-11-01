/**
 * Clasificación del resultado de la RPC `procesar_pago` (lo que viene dentro
 * del 201 de `POST /api/pedidos`).
 *
 * Un HTTP 201 no confirma el pago: el veredicto real está en `pedido.ok`, y
 * aun con `ok: true` la respuesta tiene que traer `pedido_id` y los montos
 * completos para poder limpiar el carrito sin mentirle al usuario.
 */
export type PagoResult = {
  ok: boolean;
  motivo?: string;
  mensaje?: string;
  saldo_disponible?: number;
  total?: number;
  faltante?: number;
  pedido_id?: number;
  saldo_restante?: number;
  estado?: string;
  pago_estado?: string;
  franja_retiro?: string;
  qr_token?: string;
  codigo_retiro?: string;
};

export type ClasificacionPago =
  | { tipo: 'incierto' }
  | { tipo: 'saldo_insuficiente'; resultado: PagoResult }
  | { tipo: 'rechazado'; resultado: PagoResult }
  | { tipo: 'pedido_id_invalido' }
  | { tipo: 'datos_incompletos' }
  | {
      tipo: 'confirmado';
      resultado: PagoResult & {
        pedido_id: number;
        total: number;
        saldo_restante: number;
      };
    };

export const clasificarResultadoPago = (
  resultado?: PagoResult | null
): ClasificacionPago => {
  // Un 2xx sin `pedido` no confirma ni rechaza: pudo haberse cobrado.
  if (!resultado) return { tipo: 'incierto' };

  if (!resultado.ok) {
    return {
      tipo:
        resultado.motivo === 'saldo_insuficiente'
          ? 'saldo_insuficiente'
          : 'rechazado',
      resultado,
    };
  }

  if (!Number.isInteger(resultado.pedido_id) || Number(resultado.pedido_id) <= 0) {
    return { tipo: 'pedido_id_invalido' };
  }

  if (
    typeof resultado.total !== 'number' ||
    Number.isNaN(resultado.total) ||
    typeof resultado.saldo_restante !== 'number' ||
    Number.isNaN(resultado.saldo_restante)
  ) {
    return { tipo: 'datos_incompletos' };
  }

  // Los tres campos ya fueron validados arriba; el cast solo le dice a TS lo
  // que los guards garantizan.
  return {
    tipo: 'confirmado',
    resultado: resultado as PagoResult & {
      pedido_id: number;
      total: number;
      saldo_restante: number;
    },
  };
};
