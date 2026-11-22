import { useCallback, useEffect, useRef } from 'react';
import { reiniciarIntentoCompra } from '../services/intentoCompra';

export function useCicloIntentoCompra(
  usuarioId: string | undefined, hydrated: boolean, carritoVacio: boolean,
  onError: (error: unknown) => void,
) {
  const aviso = useRef(onError);
  aviso.current = onError;
  const pendiente = useRef<{ usuarioId?: string; operacion: Promise<void> }>();
  const reiniciar = useCallback((conservarPendiente = false) => {
    const operacion = usuarioId ? reiniciarIntentoCompra(usuarioId, conservarPendiente) : Promise.resolve();
    pendiente.current = { usuarioId, operacion };
    return operacion;
  }, [usuarioId]);

  useEffect(() => {
    if (!hydrated || !carritoVacio || !usuarioId) return;
    let activo = true;
    // Se observa el estado resultante, incluso con eliminaciones agrupadas.
    void reiniciar(true).catch(error => { if (activo) aviso.current(error); });
    return () => { activo = false; };
  }, [hydrated, carritoVacio, usuarioId, reiniciar]);

  const esperarReinicio = () => {
    const actual = pendiente.current;
    return actual && actual.usuarioId === usuarioId ? actual.operacion : Promise.resolve();
  };
  return { reiniciar, esperarReinicio };
}
