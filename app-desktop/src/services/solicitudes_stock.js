import { supabase } from './supabase';
import { productos } from './productos';

/**
 * Servicio para solicitudes de reposición de stock (T17)
 * Registra pedidos de "encargar más stock" realizados por el empleado.
 * Nota: requiere tabla 'solicitudes_stock'. Si no existe, el backend devolverá error.
 */
export const solicitudesStock = {
  async resolverSolicitud({ id, cafeteriaId, usuarioId, estado }) {
    if (![id, cafeteriaId, usuarioId].every(v => Number.isSafeInteger(Number(v)) && Number(v) > 0)) {
      throw new Error('Se requiere solicitud, cafetería y usuario válidos.');
    }
    if (!['aprobado', 'rechazado'].includes(estado)) throw new Error('Resolución inválida.');
    const noDisponible = 'La solicitud ya fue resuelta o no tienes permiso para resolverla.';
    let reposicion;
    if (estado === 'aprobado') {
      const { data: solicitud, error } = await supabase.from('solicitudes_stock')
        .select('producto_id, cantidad_solicitada')
        .eq('id', id).eq('cafeteria_id', cafeteriaId).eq('estado', 'pendiente').maybeSingle();
      if (error) throw error;
      if (!solicitud) throw new Error(noDisponible);

      const producto = await productos.getById(solicitud.producto_id);
      if (!producto || Number(producto.cafeteria_id) !== Number(cafeteriaId) || producto.eliminado_en) {
        throw new Error('El producto ya no está disponible para reposición en esta cafetería.');
      }
      const cantidad = Number(solicitud.cantidad_solicitada);
      const stock = Number(producto.stock);
      if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || !Number.isSafeInteger(stock) ||
          stock < 0 || !Number.isSafeInteger(stock + cantidad)) {
        throw new Error('La cantidad solicitada o el stock actual no son válidos.');
      }
      reposicion = { productoId: solicitud.producto_id, cantidad, stock };
    }

    // Solo quien confirma la transición de pendiente a aprobado puede sumar stock.
    let actualizacion = supabase.from('solicitudes_stock')
      .update({ estado, fecha_respuesta: new Date().toISOString(), usuario_responde_id: Number(usuarioId) })
      .eq('id', id).eq('cafeteria_id', cafeteriaId).eq('estado', 'pendiente');
    if (reposicion) {
      actualizacion = actualizacion.eq('producto_id', reposicion.productoId)
        .eq('cantidad_solicitada', reposicion.cantidad);
    }
    const { data, error } = await actualizacion.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(noDisponible);

    if (reposicion) {
      const { productoId, cantidad, stock } = reposicion;
      try {
        await productos.updateStock(productoId, stock + cantidad, undefined, stock);
      } catch (error) {
        throw new Error(
          `La solicitud #${id} quedó aprobada, pero no se pudo confirmar la suma de ${cantidad} unidades. ` +
          'Revisa Productos y Stock antes de aplicar un ajuste manual.',
          { cause: error }
        );
      }
    }
    return data;
  },
  /**
   * Verifica si ya existe una solicitud pendiente equivalente
   * Equivalencia: misma cafetería, mismo producto y estado 'pendiente'
   */
  async existeSolicitudPendiente({ producto_id, cafeteria_id }) {
    const pid = producto_id !== null && producto_id !== undefined ? Number(producto_id) : null;
    const cid = cafeteria_id !== null && cafeteria_id !== undefined ? Number(cafeteria_id) : null;
    if (!Number.isFinite(pid) || !Number.isFinite(cid)) {
      throw new Error('Datos insuficientes para verificar solicitudes pendientes equivalentes.');
    }

    const { data, error } = await supabase
      .from('solicitudes_stock')
      .select('id')
      .eq('producto_id', pid)
      .eq('cafeteria_id', cid)
      .eq('estado', 'pendiente')
      .limit(1);

    if (error) {
      console.error('Error al verificar solicitudes pendientes equivalentes:', error);
      throw new Error(error.message || 'Error al consultar solicitudes pendientes equivalentes.');
    }

    return Array.isArray(data) && data.length > 0;
  },

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
    const cid = cafeteria_id !== null && cafeteria_id !== undefined ? Number(cafeteria_id) : null;
    if (!Number.isFinite(cid)) {
      throw new Error('No se pudo determinar la cafetería autorizada del empleado. Sin asociación válida.');
    }

    const payload = {
      producto_id: Number(producto_id),
      nombre_producto: nombre_producto || null,
      cantidad_solicitada: cantidad,
      cafeteria_id: cid,
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
   * Lista las solicitudes de reposición de una cafetería (solo lectura).
   *
   * S2-T17: el panel del Dueño consulta únicamente las solicitudes de su
   * cafetería autorizada. Esta consulta no procesa solicitudes ni modifica
   * inventario: solo lee lo que el sistema ya persistió.
   *
   * @param {number|string} cafeteriaId
   * @returns {Promise<Array>}
   */
  async listarPorCafeteria(cafeteriaId) {
    const cid =
      cafeteriaId !== null && cafeteriaId !== undefined
        ? Number(cafeteriaId)
        : NaN;

    if (!Number.isFinite(cid)) {
      throw new Error(
        'No se pudo determinar la cafetería autorizada para consultar solicitudes.'
      );
    }

    const { data, error } = await supabase
      .from('solicitudes_stock')
      .select('*')
      .eq('cafeteria_id', cid)
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      console.error('Error al listar solicitudes de stock:', error);
      throw new Error(
        error.message || 'No se pudieron obtener las solicitudes de reposición.'
      );
    }

    return data || [];
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
};

export default solicitudesStock;
