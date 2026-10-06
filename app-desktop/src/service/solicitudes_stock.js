import { supabase } from './supabase';

/**
 * Servicio para solicitudes de reposición de stock (T17)
 * Registra pedidos de "encargar más stock" realizados por el empleado.
 * Nota: requiere tabla 'solicitudes_stock'. Si no existe, el backend devolverá error.
 */
export const solicitudesStock = {
  /**
   * Crear una solicitud de reposición de stock
   * @param {Object} params
   * @param {number|string} params.producto_id
   * @param {string} params.nombre_producto
   * @param {number|string} params.cantidad_solicitada
   * @param {number|string} [params.cafeteria_id]
   * @param {string} [params.usuario_id] - UUID del usuario que solicita
   * @param {string} [params.observaciones]
   */
  async crearSolicitud({
    producto_id,
    nombre_producto,
    cantidad_solicitada,
    cafeteria_id = null,
    usuario_id = null,
    observaciones = '',
  }) {
    const cantidad = Number(cantidad_solicitada);
    if (isNaN(cantidad) || cantidad <= 0) {
      throw new Error('La cantidad solicitada debe ser mayor a 0.');
    }

    const payload = {
      producto_id: Number(producto_id),
      nombre_producto: nombre_producto || null,
      cantidad_solicitada: cantidad,
      cafeteria_id,
      usuario_id,
      observaciones: observaciones || null,
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('solicitudes_stock')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error al crear solicitud de stock:', error);
      throw new Error(error.message || 'No se pudo registrar la solicitud de stock.');
    }

    return data;
  },

  /**
   * Listar solicitudes (opcional para empleado; no requerido por T17)
   */
  async listarSolicitudes() {
    const { data, error } = await supabase
      .from('solicitudes_stock')
      .select('*')
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      throw new Error(error.message || 'No se pudieron obtener las solicitudes de stock.');
    }
    return data || [];
  },

  /**
   * Listar solicitudes filtrando por estado.
   * La vista del dueño arranca en 'pendiente'.
   * @param {string} [estado] - pendiente | aprobado | rechazado
   */
  async listarPorEstado(estado = 'pendiente') {
    const { data, error } = await supabase
      .from('solicitudes_stock')
      .select('*')
      .eq('estado', estado)
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      throw new Error(error.message || 'No se pudieron obtener las solicitudes de stock.');
    }
    return data || [];
  },

  /**
   * Marcar una solicitud como APROBADA y sumar la cantidad al stock del producto.
   *
   * El stock se suma solo al aprobar: es lo que pidió el dueño de la funcionalidad.
   *
   * OJO - atomicidad: son dos escrituras separadas (la solicitud y el producto).
   * Si la segunda falla, la solicitud queda aprobada sin el stock aplicado. La
   * alternativa es un trigger en la BD (o una funcion RPC) que lo haga en una
   * sola transaccion; queda pendiente de que exista el esquema.
   *
   * @param {number|string} id - id de la solicitud
   * @param {number|string} usuarioId - usuarios.id del dueño que responde
   * @returns {Object} la solicitud actualizada
   */
  async aprobarSolicitud(id, usuarioId) {
    const solicitud = await this.getById(id);

    if (!solicitud) {
      throw new Error('La solicitud no existe.');
    }
    if (solicitud.estado !== 'pendiente') {
      throw new Error(`La solicitud ya fue ${solicitud.estado} y no se puede volver a cambiar.`);
    }

    const { data, error } = await supabase
      .from('solicitudes_stock')
      .update({
        estado: 'aprobado',
        fecha_respuesta: new Date().toISOString(),
        usuario_responde_id: usuarioId != null ? Number(usuarioId) : null,
      })
      .eq('id', Number(id))
      .select()
      .single();

    if (error) {
      console.error('Error aprobando solicitud de stock:', error);
      throw new Error(error.message || 'No se pudo aprobar la solicitud.');
    }

    await this.sumarStockProducto(solicitud);

    return data;
  },

  /**
   * Marcar una solicitud como RECHAZADA. No toca el stock.
   *
   * @param {number|string} id - id de la solicitud
   * @param {number|string} usuarioId - usuarios.id del dueño que responde
   * @returns {Object} la solicitud actualizada
   */
  async rechazarSolicitud(id, usuarioId) {
    const solicitud = await this.getById(id);

    if (!solicitud) {
      throw new Error('La solicitud no existe.');
    }
    if (solicitud.estado !== 'pendiente') {
      throw new Error(`La solicitud ya fue ${solicitud.estado} y no se puede volver a cambiar.`);
    }

    const { data, error } = await supabase
      .from('solicitudes_stock')
      .update({
        estado: 'rechazado',
        fecha_respuesta: new Date().toISOString(),
        usuario_responde_id: usuarioId != null ? Number(usuarioId) : null,
      })
      .eq('id', Number(id))
      .select()
      .single();

    if (error) {
      console.error('Error rechazando solicitud de stock:', error);
      throw new Error(error.message || 'No se pudo rechazar la solicitud.');
    }

    return data;
  },

  /**
   * Leer una solicitud por id.
   * @param {number|string} id
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('solicitudes_stock')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo solicitud de stock:', error);
      throw new Error(error.message || 'No se pudo obtener la solicitud.');
    }
    return data;
  },

  /**
   * Sumar `cantidad_solicitada` al stock del producto.
   *
   * NO reutiliza productosService.updateStock a proposito: ese metodo es
   * absoluto (fija el valor) y ademas escribe la columna `minimo`, que no
   * existe en esta base de datos - pasarla rompe el UPDATE.
   *
   * @private
   */
  async sumarStockProducto(solicitud) {
    const productoId = solicitud.producto_id;
    if (productoId == null) return;

    const cantidad = Number(solicitud.cantidad_solicitada);
    if (!cantidad || cantidad <= 0) return;

    const { data: producto, error: errorLectura } = await supabase
      .from('productos')
      .select('id, nombre, stock')
      .eq('id', productoId)
      .maybeSingle();

    if (errorLectura) {
      console.error('Error leyendo producto para sumar stock:', errorLectura);
      throw new Error(errorLectura.message || 'La solicitud se aprobó, pero no se pudo leer el producto.');
    }

    if (!producto) {
      console.warn('La solicitud aprobada apunta a un producto que ya no existe:', productoId);
      return;
    }

    const stockActual = Number(producto.stock || 0);

    const { error: errorUpdate } = await supabase
      .from('productos')
      .update({ stock: stockActual + cantidad })
      .eq('id', productoId);

    if (errorUpdate) {
      console.error('Error sumando stock al producto:', errorUpdate);
      throw new Error(errorUpdate.message || 'La solicitud se aprobó, pero no se pudo actualizar el stock.');
    }
  },
};

export default solicitudesStock;
