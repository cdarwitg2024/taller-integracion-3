'use strict';

const express = require('express');

const router = express.Router();
const { listar, obtenerPorId, precios } = require('./menus.controller');

// Un solo recurso: productos. Sin sub-recursos publicos.
router.get('/', listar);

// INTERNO. Se declara ANTES que /:id a proposito: si el id fuera numerico
// wouldnaria colisionar, pero un id como "precios" caeria en listarPorId. Este
// orden hace que la ruta interna gane siempre.
//
// Por fuera no se llega: el gateway responde 404 en /api/menus/precios.
router.post('/precios', precios);

router.get('/:id', obtenerPorId);

module.exports = router;