import { supabase } from '../lib/supabase';

type Producto = { id: number | string; precio: number | string; [key: string]: unknown };

/** El mismo cálculo PostgreSQL utilizado al cobrar. Una instalación anterior
 * sin esta RPC conserva los precios base hasta activar la migración. */
export async function aplicarPreciosPromocion<T extends Producto>(productos: T[]): Promise<T[]> {
  if (!productos.length) return productos;
  const { data, error } = await supabase.rpc('cotizar_promociones', {
    p_ids: productos.map(p => Number(p.id)),
  });
  if (error) {
    if (['PGRST202', '42883'].includes(error.code)) return productos;
    throw new Error('No se pudieron verificar las promociones. Actualiza el menú antes de comprar.');
  }
  const precios = new Map<number, { precio: number; precio_base: number }>(
    (data || []).map((p: { id: number; precio: number; precio_base: number }) => [Number(p.id), p])
  );
  return productos.map(p => {
    const cotizacion = precios.get(Number(p.id));
    if (!cotizacion || !Number.isFinite(Number(cotizacion.precio)) || Number(cotizacion.precio) <= 0) {
      throw new Error('El catálogo cambió. Vuelve a actualizar el menú.');
    }
    return { ...p, precio: Number(cotizacion.precio), precio_base: Number(cotizacion.precio_base) };
  });
}
