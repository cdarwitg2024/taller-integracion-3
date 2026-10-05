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

    // `id` es BIGINT en Postgres. Validar aqui evita que un id no numerico
    // llegue a PostgREST y devuelva un 400 sin formato.
    if (!/^\d+$/.test(id)) {
      throw new HttpError(400, 'El id debe ser un entero positivo', {
        detalle: `Recibido: ${id}`
      });
    }

    const cafeteria = await CafeteriasService.obtenerPorId(Number(id));

    if (!cafeteria) {
      throw new HttpError(404, 'Cafeteria no encontrada', { detalle: `id=${id}` });
    }

    res.status(200).json({ data: cafeteria });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtenerPorId };