import { supabase } from '../lib/supabase';
import { evaluarDisponibilidad, mensajeProblemas } from '../utils/revalidacionCarrito';

export async function verificarDisponibilidadCheckout(
  cart: { id: number; name: string; quantity: number; cafeteriaId: number }[], cafeteriaId: number,
): Promise<{ titulo: string; mensaje: string } | null> {
  try {
    const ids = Array.from(new Set(cart.map(item => item.id)));
    const { data, error } = await supabase.from('productos')
      .select('id, cafeteria_id, nombre, activo, eliminado_en, stock').in('id', ids);
    if (error) throw error;
    const problemas = evaluarDisponibilidad(cart, data, cafeteriaId);
    return problemas.length ? { titulo: 'Hay cambios en la disponibilidad', mensaje: mensajeProblemas(problemas) } : null;
  } catch {
    return { titulo: 'No se pudo verificar disponibilidad',
      mensaje: 'Ocurrió un error al consultar el estado actual de los productos. El carrito no fue modificado. Intenta nuevamente.' };
  }
}
