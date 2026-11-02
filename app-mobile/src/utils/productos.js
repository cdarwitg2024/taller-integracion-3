/**
 * Aplica un cambio de Realtime (`useDisponibilidadProductos`) a la lista de
 * productos que muestra el menú, sin volver a traer todo el catálogo.
 *
 * Devuelve la lista nueva y `recargar: true` cuando el producto no estaba en
 * la lista (por ejemplo, se reactivó): en ese caso no alcanza con parchear.
 */
export const aplicarCambioProducto = (productos, cambio) => {
  const activo = cambio.activo !== false && cambio.activo !== null;
  const eliminado = Boolean(cambio.eliminadoEn);

  // Desactivado o eliminado: sale del catálogo
  if (!activo || eliminado) {
    return {
      productos: productos.filter((p) => p.id !== cambio.id),
      recargar: false,
    };
  }

  // No estaba en la lista: hay que recargar para traerlo con toda su info
  if (!productos.some((p) => p.id === cambio.id)) {
    return { productos, recargar: true };
  }

  const stock = Number(cambio.stock) || 0;
  return {
    productos: productos.map((p) =>
      p.id === cambio.id
        ? {
            ...p,
            stock,
            price: Number.isFinite(cambio.precio) ? cambio.precio : p.price,
            available: stock > 0,
          }
        : p
    ),
    recargar: false,
  };
};

/** Producto abierto en el detalle: se busca por id para seguir la lista viva. */
export const productoPorId = (lista, id) =>
  lista.find((p) => p.id === id) ?? null;
