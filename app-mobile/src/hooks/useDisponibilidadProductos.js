import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Suscripción en vivo a la disponibilidad de los productos de una cafetería.
 *
 * FR-10 — la lista se actualiza sola cuando cambia el stock o el estado de un
 * producto, sin cerrar y abrir la app.
 *
 * Qué resuelve:
 *   - Suscripción a `productos` (UPDATE de stock/activo, INSERT y DELETE)
 *   - Detecta cambios y expone solo el id afectado, para que la pantalla
 *     aplique el cambio sin volver a traer toda la lista
 *   - No deja suscripciones duplicadas: guarda el canal en una ref y lo
 *     remueve antes de crear otro
 *   - Libera la suscripción (removeChannel) al salir de la pantalla
 *
 * Notar que el filtro `cafeteria_id=eq.X` viene del servidor de Realtime, así
 * que un producto de otra cafetería ni siquiera llega al callback.
 *
 * Uso:
 *   const { connected, cambios } = useDisponibilidadProductos(cafeteriaId);
 */
export const useDisponibilidadProductos = (cafeteriaId) => {
  const [connected, setConnected] = useState(false);
  const [cambios, setCambios] = useState([]);

  // Ref, no estado: no queremos re-renderizar al crear el canal
  const canalRef = useRef(null);

  // Ref del id de cafetería para que el callback no quede obsoleto
  const cafeteriaRef = useRef(cafeteriaId);
  cafeteriaRef.current = cafeteriaId;

  useEffect(() => {
    if (!cafeteriaId) return undefined;

    // Por si el efecto se re-ejecuta, cerramos el canal anterior ANTES de abrir
    // uno nuevo. Sin esto se acumularían suscripciones y cada cambio dispararía
    // el callback N veces.
    if (canalRef.current) {
      supabase.removeChannel(canalRef.current);
      canalRef.current = null;
    }

    const canal = supabase
      .channel(`productos-cafeteria-${cafeteriaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'productos',
          filter: `cafeteria_id=eq.${cafeteriaId}`,
        },
        (payload) => {
          const nuevo = payload.new;
          if (!nuevo) return;
          setCambios((prev) => [
            {
              id: Number(nuevo.id),
              stock: Number(nuevo.stock) || 0,
              activo: nuevo.activo,
              eliminadoEn: nuevo.eliminado_en ?? null,
              ts: Date.now(),
            },
            // Solo guardamos los últimos cambios: la pantalla consume el
            // primero y descarta el resto, no hace falta acumular historial.
            ...prev.slice(0, 19),
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'productos',
          filter: `cafeteria_id=eq.${cafeteriaId}`,
        },
        // Un producto nuevo no se puede "parchear": hay que recargar la lista
        (payload) => setCambios((prev) => [{ recargar: true, ts: Date.now() }, ...prev.slice(0, 19)])
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'productos',
          filter: `cafeteria_id=eq.${cafeteriaId}`,
        },
        (payload) =>
          setCambios((prev) => [
            { eliminadoId: Number(payload.old?.id), ts: Date.now() },
            ...prev.slice(0, 19),
          ])
      )
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[FR-10] Canal de productos en estado: ${status}`);
        }
      });

    canalRef.current = canal;

    // Limpieza al salir de la pantalla: sin esto la suscripción sigue viva y
    // la app queda escuchando cambios para siempre.
    return () => {
      supabase.removeChannel(canal);
      canalRef.current = null;
      setConnected(false);
    };
  }, [cafeteriaId]);

  return { connected, cambios };
};

export default useDisponibilidadProductos;
