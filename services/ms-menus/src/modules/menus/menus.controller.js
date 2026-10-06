'use strict';

const { HttpError } = require('@coffeefaster/shared');
const MenusService = require('./menus.service');

/**
 * GET /api/menus?cafeteria_id=N
 *
 * Publico: el movil necesita ver el menu antes de que el usuario inicie sesion.
 * El filtro es opcional; si viene, debe ser un entero positivo.
 */
async function listar(req, res, next) {
  try {
    const { cafeteria_id } = req.query;

    let cafeteriaId;
    if (cafeteria_id !== undefined) {
      if (!/^\d+$/.test(String(cafeteria_id))) {
        throw new HttpError(400, 'cafeteria_id debe ser un entero positivo', {
          detalle: `Recibido: ${cafeteria_id}`
        });
      }
      cafeteriaId = Number(cafeteria_id);
    }

    const productos = await MenusService.listar({ cafeteria_id: cafeteriaId });

    res.status(200).json({
      data: productos,
      total: productos.length,
      filtro: cafeteriaId === undefined ? null : { cafeteria_id: cafeteriaId }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/menus/:id
 */
async function obtenerPorId(req, res, next) {
  try {
    const { id } = req.params;

    // `id` es BIGINT en Postgres. Validar aqui evita un 400 sin formato de
    // PostgREST cuando llega algo no numerico.
    if (!/^\d+$/.test(id)) {
      throw new HttpError(400, 'El id debe ser un entero positivo', {
        detalle: `Recibido: ${id}`
      });
    }

    const producto = await MenusService.obtenerPorId(Number(id));

    if (!producto) {
      throw new HttpError(404, 'Producto no encontrado', { detalle: `id=${id}` });
    }

    res.status(200).json({ data: producto });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/menus/precios  — INTERNO, solo ms-pedidos.
 *
 * Recibe  { items: [{ producto_id, cantidad }] }  (o el array pelado)
 * Devuelve [{ id, nombre, precio, activo, cafeteria_id }]
 *
 * El precio lo pone la base de datos, nunca el cliente. ms-pedidos multiplica
 * `precio * cantidad` para el total.
 *
 * Esta ruta NO esta en el gateway: el nginx responde 404 antes de llegar aqui.
 */
async function precios(req, res, next) {
  try {
    const productos = await MenusService.precios(req.body);

    res.status(200).json({
      data: productos,
      total: productos.length
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtenerPorId, precios };