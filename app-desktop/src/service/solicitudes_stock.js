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
