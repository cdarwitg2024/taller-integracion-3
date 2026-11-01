/**
 * Revalidación no destructiva del carrito antes de pagar.
 *
 * Compara el carrito contra el estado actual de los productos en la base.
 * Devuelve la lista de problemas; el carrito no se toca acá.
 *
 * Un producto que no viene en el resultado se trata como desactivado: puede
 * haberlo filtrado RLS, haberlo borrado otro usuario o haber cambiado de
 * cafetería. En todos los casos el pago se bloquea en vez de cobrar algo que
 * ya no existe.
 */
export type ProblemaCarrito = {
  tipo: 'desactivado' | 'sin_stock';
  nombre: string;
  solicitado: number;
  stock?: number;
};

type ItemCarrito = {
  id: number;
  name: string;
  quantity: number;
};

type ProductoActual = {
  id: number;
  cafeteria_id: number;
  nombre?: string | null;
  activo?: boolean | null;
  eliminado_en?: string | null;
  stock?: number | null;
};

export const evaluarDisponibilidad = (
  carrito: ItemCarrito[],
  productos: ProductoActual[] | null | undefined,
  cafeteriaId: number
): ProblemaCarrito[] => {
  const porId = new Map<number, ProductoActual>();
  (Array.isArray(productos) ? productos : []).forEach((p) => {
    porId.set(Number(p.id), p);
  });

  const problemas: ProblemaCarrito[] = [];

  for (const item of carrito) {
    const producto = porId.get(Number(item.id));

    if (!producto) {
      problemas.push({
        tipo: 'desactivado',
        nombre: item.name,
        solicitado: item.quantity,
      });
      continue;
    }

    if (Number(producto.cafeteria_id) !== Number(cafeteriaId)) {
      problemas.push({
        tipo: 'desactivado',
        nombre: producto.nombre || item.name,
        solicitado: item.quantity,
      });
      continue;
    }

    const activo = producto.activo !== false && producto.activo !== null;
    const eliminado = Boolean(producto.eliminado_en);
    if (!activo || eliminado) {
      problemas.push({
        tipo: 'desactivado',
        nombre: producto.nombre || item.name,
        solicitado: item.quantity,
      });
      continue;
    }

    const stock = Number(producto.stock);
    if (Number.isFinite(stock) && stock < Number(item.quantity)) {
      problemas.push({
        tipo: 'sin_stock',
        nombre: producto.nombre || item.name,
        solicitado: Number(item.quantity),
        stock,
      });
    }
  }

  return problemas;
};

/** Mensaje único de alerta a partir de los problemas detectados. */
export const mensajeProblemas = (problemas: ProblemaCarrito[]): string => {
  const desactivados = problemas.filter((x) => x.tipo === 'desactivado');
  const sinStock = problemas.filter((x) => x.tipo === 'sin_stock');
  const lineas: string[] = [];

  if (desactivados.length > 0) {
    lineas.push('Producto(s) desactivado(s) o no disponible(s):');
    lineas.push(
      ...desactivados.slice(0, 6).map((x) => `• ${x.nombre}`)
    );
    if (desactivados.length > 6) {
      lineas.push(`• ... y ${desactivados.length - 6} más`);
    }
  }

  if (sinStock.length > 0) {
    if (lineas.length > 0) lineas.push('');
    lineas.push('Producto(s) sin stock suficiente:');
    lineas.push(
      ...sinStock
        .slice(0, 6)
        .map(
          (x) =>
            `• ${x.nombre} (solicitado: ${x.solicitado}` +
            `${Number.isFinite(x.stock) ? `, stock: ${x.stock}` : ''})`
        )
    );
    if (sinStock.length > 6) {
      lineas.push(`• ... y ${sinStock.length - 6} más`);
    }
  }

  lineas.push('');
  lineas.push(
    'El carrito no fue modificado. Ajusta las cantidades o elimina los productos afectados antes de pagar.'
  );

  return lineas.join('\n');
};
