export const crearEstadoCarrito = () => ({
  cart: [], cafeteriaId: null, codigo: '', cotizacion: null, requiereCotizacion: false, requiereRecotizar: false, revision: 0, idCarrito: 0,
});

function cafeteriaDelCarrito(cart) {
  const id = Number(cart[0]?.cafeteriaId);
  return Number.isSafeInteger(id) && id > 0 &&
    cart.every((producto) => Number(producto.cafeteriaId) === id) ? id : null;
}

export function actualizarEstadoCarrito(estado, accion) {
  switch (accion.tipo) {
    case 'carrito': {
      const cart = typeof accion.valor === 'function' ? accion.valor(estado.cart) : accion.valor;
      if (cart === estado.cart) return estado;
      const cafeteriaId = cafeteriaDelCarrito(cart);
      const cambiaCarrito = !cart.length || cafeteriaId !== estado.cafeteriaId;
      return { ...estado, cart, cafeteriaId,
        codigo: cafeteriaId && !cambiaCarrito ? estado.codigo : '',
        cotizacion: null, requiereCotizacion: !cambiaCarrito && estado.requiereCotizacion,
        requiereRecotizar: Boolean(cafeteriaId && (accion.requiereRecotizar || (!cambiaCarrito && estado.requiereRecotizar))),
        revision: estado.revision + 1,
        idCarrito: estado.idCarrito + Number(cambiaCarrito),
      };
    }
    case 'reconfirmar':
      return { ...estado, requiereRecotizar: accion.valor, cotizacion: null, revision: estado.revision + 1 };
    case 'codigo': {
      const codigo = estado.cafeteriaId ? accion.valor.trim() : '';
      if (codigo === estado.codigo) return estado;
      return { ...estado, codigo, cotizacion: null, revision: estado.revision + 1 };
    }
    case 'cotizacion':
      // La revisión se captura al solicitar: las respuestas de otro contexto se descartan.
      return accion.revision === estado.revision && estado.cafeteriaId
        ? { ...estado, cotizacion: accion.valor, requiereCotizacion: true } : estado;
    default:
      return estado;
  }
}
