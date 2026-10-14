'use strict';

const { HttpError } = require('@coffeefaster/shared');
const CafeteriasService = require('./cafeterias.service');

/**
 * GET /api/cafeterias
 * Lista las cafeterias activas. Publico: el movil la necesita antes de que el
 * usuario haya iniciado sesion.
 */
async function listar(req, res, next) {
  try {
    const cafeterias = await CafeteriasService.listar({ soloActivas: true });

    res.status(200).json({
      data: cafeterias,
      total: cafeterias.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cafeterias/:id
 */
async function obtenerPorId(req, res, next) {
  try {
    const { id } = req.params;

    // `id` es BIGINT en Postgres. Se valida aqui para que un id invalido
    // responda 400 con formato propio en vez del 400 crudo de PostgREST.
    //
    // Solo se aceptan enteros positivos representables de forma segura en JS:
    // un id mayor que Number.MAX_SAFE_INTEGER perderia precision al convertirlo
    // y la consulta podria pedir OTRO id distinto al solicitado. En ese caso se
    // rechaza (400) en vez de consultar un id equivocado.
    if (!/^\d+$/.test(id)) {
      throw new HttpError(400, 'El id debe ser un entero positivo', {
        detalle: `Recibido: ${id}`
      });
    }

    const idNumerico = Number(id);
    if (!Number.isSafeInteger(idNumerico) || idNumerico <= 0) {
      throw new HttpError(400, 'El id debe ser un entero positivo', {
        detalle: `Recibido: ${id}`
      });
    }

    const cafeteria = await CafeteriasService.obtenerPorId(idNumerico);

    if (!cafeteria) {
      throw new HttpError(404, 'Cafeteria no encontrada', { detalle: `id=${id}` });
    }

    res.status(200).json({ data: cafeteria });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtenerPorId };