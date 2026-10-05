'use strict';

/**
 * Servicio de menus (productos). SIN MOCKS.
 *
 * Decisiones:
 *  - UN SOLO recurso: `productos`. No se une con `categorias` por decision de
 *    arquitectura (ms-menus no expone categorias).
 *  - NO se lee `stock` ni `stock_minimo`. El stock es de ms-inventario: si
 *    ms-menus lo expusiera, el catalogo y el inventario podrian desincronizarse
 *    y el mobile tendria dos verdades de la misma fila.
 *  - Se filtra `eliminado_en IS NULL` porque la tabla tiene borrado logico: sin
 *    ese filtro, un producto retirado seguiria apareciendo en el menu.
 *  - El precio SIEMPRE sale de la base. Nunca del cuerpo del request. Es el
 *    bug que se corrigio: el cliente mandaba el precio y el backend lo creia.
 */

const { obtenerCliente, HttpError } = require('@coffeefaster/shared');

const TABLA = 'productos';

// Columnas reales de la tabla `productos`, verificadas contra el esquema local.
// `stock`, `stock_minimo`, `categoria_id` y los timestamps quedan fuera a
// proposito: son de ms-inventario / no aportan al menu.
const COLUMNAS = 'id, cafeteria_id, nombre, precio, activo';

// Techo de items por llamada a /precios. Sin limite, un cliente podria pedir
// 1e6 de ids y agotar la memoria del Pod.
const MAX_ITEMS_PRECIO = 100;
const CANTIDAD_MAXIMA = 999;

const CAMPOS_ENTEROS = ['producto_id', 'cantidad'];

function esEnteroPositivo(valor) {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

/**
 * Valida el cuerpo de POST /api/menus/precios.
 *
 * Acepta `{ items: [...] }` o un array pelado. Devuelve una lista de ids unicos
 * conservando el orden de primera aparicion, porque el orden importa para que
 * ms-pedidos pueda emparejar por posicion.
 *
 * @param {any} cuerpo
 * @returns {number[]} ids de producto, unicos y en orden
 */
function validarItems(cuerpo) {
  const items = Array.isArray(cuerpo) ? cuerpo : cuerpo && cuerpo.items;

  if (!Array.isArray(items)) {
    throw new HttpError(400, 'El cuerpo debe ser un array de items o {items: [...]}');
  }

  if (items.length === 0) {
    throw new HttpError(400, 'La lista de items no puede estar vacia');
  }

  if (items.length > MAX_ITEMS_PRECIO) {
    throw new HttpError(
      400,
      `La lista no puede tener mas de ${MAX_ITEMS_PRECIO} items`,
      { detalle: `Recibidos: ${items.length}` }
    );
  }

  const vistos = new Set();
  const ids = [];

  items.forEach((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, `El item ${i} no es un objeto`);
    }

    for (const campo of CAMPOS_ENTEROS) {
      if (!esEnteroPositivo(item[campo])) {
        throw new HttpError(400, `El item ${i} tiene un ${campo} invalido`, {
          detalle: `${campo} debe ser un entero positivo. Recibido: ${JSON.stringify(item[campo])}`
        });
      }
    }

    // Duplicados se agregan en vez de rechazarse: un carrito puede enviar el
    // mismo producto dos veces y el total debe salir bien igual.
    if (!vistos.has(item.producto_id)) {
      vistos.add(item.producto_id);
      ids.push(item.producto_id);
    }
  });

  return ids;
}

const MenusService = {
  validarItems,

  /**
   * Lista productos activos.
   * @param {{cafeteria_id?: number}} [filtros]
   * @returns {Promise<Array<object>>}
   */
  async listar({ cafeteria_id } = {}) {
    const cliente = obtenerCliente();

    let consulta = cliente
      .from(TABLA)
      .select(COLUMNAS)
      .is('eliminado_en', null)
      .eq('activo', true);

    if (cafeteria_id !== undefined) {
      consulta = consulta.eq('cafeteria_id', cafeteria_id);
    }

    const { data, error } = await consulta.order('nombre', { ascending: true });

    if (error) throw error;

    return data || [];
  },

  /**
   * Un producto por id. Solo si esta activo y no fue borrado logicamente.
   * @returns {Promise<object|null>} null si no existe, esta inactivo o fue borrado.
   */
  async obtenerPorId(id) {
    const cliente = obtenerCliente();

    const { data, error } = await cliente
      .from(TABLA)
      .select(COLUMNAS)
      .eq('id', id)
      .eq('activo', true)
      .is('eliminado_en', null)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  },

  /**
   * Precios autoritativos para un carrito.
   *
   * Recibe [{producto_id, cantidad}] y devuelve una fila por producto, con el
   * precio LEIDO DE LA BASE. El cliente que llama calcula el total con
   * `precio * cantidad` usando su propia peticion.
   *
   * Se filtran los inactivos y los borrados logicamente, en vez de devolverlos
   * con `activo: false`: son datos que inducen a error y ningun comprador puede
   * comprarlos. El error 404 los nombra, para que ms-pedidos pueda explicar.
   *
   * @param {Array<{producto_id:number, cantidad:number}>} items
   * @returns {Promise<Array<{id:number,nombre:string,precio:number,activo:boolean,cafeteria_id:number}>>}
   */
  async precios(items) {
    const ids = validarItems(items);

    const cliente = obtenerCliente();

    const { data, error } = await cliente
      .from(TABLA)
      .select(COLUMNAS)
      .in('id', ids)
      .eq('activo', true)
      .is('eliminado_en', null);

    if (error) throw error;

    const encontrados = data || [];

    const porId = new Map(encontrados.map((p) => [p.id, p]));

    const faltantes = ids.filter((id) => !porId.has(id));

    if (faltantes.length > 0) {
      throw new HttpError(404, 'Uno o mas productos no existen o no estan disponibles', {
        detalle: `Ids no disponibles: ${faltantes.join(', ')}`
      });
    }

    // Se respeta el orden de la peticion para que el caller pueda emparejar.
    return ids.map((id) => {
      const p = porId.get(id);
      return {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        activo: p.activo,
        cafeteria_id: p.cafeteria_id
      };
    });
  }
};

module.exports = MenusService;