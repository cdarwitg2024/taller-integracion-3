'use strict';

/**
 * Servicio de cafeterias. SIN MOCKS.
 *
 * Si Supabase falla, el error sube y el controller responde 503. El criterio es
 * explicito: devolver datos de memoria cuando la base esta caida esconde el
 * problema y le devuelve al cliente informacion que no existe en la fuente.
 */

const { obtenerCliente } = require('@coffeefaster/shared');

const TABLA = 'cafeterias';

// Columnas publicas. Se listan a mano y no con `select('*')` para no filtrar por
// accidente una columna interna si alguien agrega una a la tabla.
// Verificadas contra el esquema real de la tabla `cafeterias` en Supabase local.
// Se listan a mano y no con `select('*')` para no filtrar por accidente una
// columna interna si alguien agrega una a la tabla.
const COLUMNAS = [
  'id',
  'campus_id',
  'nombre',
  'descripcion',
  'hora_apertura',
  'hora_cierre',
  'telefono',
  'imagen_url',
  'activa',
].join(', ');

const CafeteriasService = {
  /**
   * Lista las cafeterias activas, ordenadas por nombre.
   * @returns {Promise<Array<object>>}
   */
  async listar({ soloActivas = true } = {}) {
    const cliente = obtenerCliente();

    let consulta = cliente.from(TABLA).select(COLUMNAS);

    if (soloActivas) {
      consulta = consulta.eq('activa', true);
    }

    const { data, error } = await consulta.order('nombre', { ascending: true });

    if (error) throw error;

    return data || [];
  },

  /**
   * Obtiene una cafeteria por id.
   * @returns {Promise<object|null>} null si no existe.
   */
  async obtenerPorId(id) {
    const cliente = obtenerCliente();

    const { data, error } = await cliente
      .from(TABLA)
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  }
};

module.exports = CafeteriasService;