/**
 * S2-T16: reconciliación entre los movimientos confirmados por la base y las
 * recargas "optimistas" (temporales) que la pantalla muestra mientras la RPC
 * `recargar_saldo` responde.
 *
 * El problema que resuelve: al recargar, WalletScreen inserta un movimiento
 * temporal y, al mismo tiempo, los eventos Realtime de `wallets` y
 * `movimientos_wallet` disparan un refetch. Si el movimiento real llega antes
 * que la respuesta de la RPC, la lista termina con el temporal + el real (la
 * recarga se ve dos veces). Si llega después, el temporal desaparece de golpe.
 *
 * La regla es simple: un temporal deja de mostrarse en cuanto existe en la
 * base un movimiento de recarga equivalente (mismo monto y creado dentro de
 * la ventana de la operación). No se comparan ids porque la RPC no devuelve
 * el id del movimiento insertado.
 */

/** Tipo mínimo que necesita la reconciliación (compatible con `Movimiento`). */
export type MovimientoWallet = {
  id: string;
  tipo: 'recarga' | 'compra' | 'reembolso';
  monto: number;
  descripcion: string;
  creado_en: string;
  pedido_id?: number | null;
};

/** Recarga mostrada mientras la RPC todavía no confirma (o falla). */
export interface RecargaPendiente {
  id: string;
  monto: number;
  /** `Date.now()` del momento en que se envió la recarga. */
  iniciadaEn: number;
  descripcion: string;
}

/**
 * Ventana de tolerancia para emparejar el movimiento real con el temporal.
 * Cubre desfases de reloj entre el dispositivo y la base; dos recargas del
 * mismo monto dentro de la ventana se emparejan una a una (no se colapsan).
 */
export const TOLERANCIA_RECARGA_MS = 2 * 60 * 1000;

const fechaMs = (iso: string): number => {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const coincideConPendiente = (
  mov: MovimientoWallet,
  pendiente: RecargaPendiente
): boolean =>
  mov.tipo === 'recarga' &&
  Number(mov.monto) === Number(pendiente.monto) &&
  fechaMs(mov.creado_en) >= pendiente.iniciadaEn - TOLERANCIA_RECARGA_MS;

/**
 * Empareja cada recarga pendiente con un movimiento confirmado distinto.
 * Devuelve los ids de las pendientes que YA están reflejadas en la base.
 *
 * Se usa emparejamiento uno a uno para que dos recargas iguales seguidas no
 * se confundan entre sí.
 */
export function emparejarRecargasConfirmadas(
  confirmados: MovimientoWallet[],
  pendientes: RecargaPendiente[]
): Set<string> {
  const usados = new Set<number>();
  const confirmadas = new Set<string>();

  pendientes.forEach((pendiente) => {
    const indice = confirmados.findIndex(
      (mov, i) => !usados.has(i) && coincideConPendiente(mov, pendiente)
    );

    if (indice >= 0) {
      usados.add(indice);
      confirmadas.add(pendiente.id);
    }
  });

  return confirmadas;
}

/** Convierte una recarga pendiente en el movimiento que se muestra en la lista. */
export function movimientoDeRecargaPendiente(
  pendiente: RecargaPendiente
): MovimientoWallet {
  return {
    id: pendiente.id,
    tipo: 'recarga',
    monto: pendiente.monto,
    descripcion: pendiente.descripcion,
    creado_en: new Date(pendiente.iniciadaEn).toISOString(),
    pedido_id: null,
  };
}

/**
 * Lista a mostrar: las recargas pendientes que todavía no están confirmadas,
 * arriba, seguidas de los movimientos confirmados.
 */
export function reconciliarMovimientos(
  confirmados: MovimientoWallet[],
  pendientes: RecargaPendiente[]
): MovimientoWallet[] {
  const yaConfirmadas = emparejarRecargasConfirmadas(confirmados, pendientes);
  const idsConfirmados = new Set(confirmados.map((mov) => String(mov.id)));

  const pendientesVisibles = pendientes
    .filter(
      (pendiente) =>
        !yaConfirmadas.has(pendiente.id) && !idsConfirmados.has(pendiente.id)
    )
    .map(movimientoDeRecargaPendiente);

  return [...pendientesVisibles, ...confirmados];
}

/**
 * Descarta las recargas pendientes que el refetch ya trajo como confirmadas,
 * para que no queden guardadas indefinidamente en memoria.
 */
export function depurarRecargasPendientes(
  pendientes: RecargaPendiente[],
  confirmados: MovimientoWallet[]
): RecargaPendiente[] {
  const yaConfirmadas = emparejarRecargasConfirmadas(confirmados, pendientes);
  return pendientes.filter((pendiente) => !yaConfirmadas.has(pendiente.id));
}
