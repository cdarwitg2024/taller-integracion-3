import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { cotizarCarritoAfiliado } from '../services/cotizarCarritoAfiliado';

export function useCotizacionCarrito(usuarioId) {
  const { cart, cafeteriaId, codigo, revision, cotizacion, guardarCotizacion, hydrated } = useCart();
  const solicitud = useMemo(() => hydrated && usuarioId && cafeteriaId
    ? { cafeteriaId, cart, codigo, revision } : null,
  [hydrated, usuarioId, cafeteriaId, cart, codigo, revision]);
  const [respuesta, setRespuesta] = useState(null);

  useEffect(() => {
    if (!solicitud) return;
    const { cafeteriaId, cart, codigo, revision } = solicitud;
    let activa = true;
    cotizarCarritoAfiliado(cafeteriaId, cart, codigo).then(
      importes => {
        if (!activa) return;
        guardarCotizacion(importes, revision);
        setRespuesta({ solicitud, estado: 'lista' });
      },
      error => {
        if (!activa) return;
        const estado = error.status === 422 ? 'inelegible' : 'no_disponible';
        setRespuesta({ solicitud, estado });
      },
    );
    return () => { activa = false; };
  }, [solicitud, guardarCotizacion]);

  if (!solicitud) return { estado: 'inactiva' };
  if (respuesta?.solicitud !== solicitud) return { estado: 'cargando' };
  return { estado: respuesta.estado, cotizacion: respuesta.estado === 'lista' ? cotizacion : null };
}
