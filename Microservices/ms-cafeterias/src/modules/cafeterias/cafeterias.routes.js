'use strict';

const express = require('express');

const router = express.Router();
const { listar, obtenerPorId } = require('./cafeterias.controller');

// Un solo recurso: cafeterias. Sin sub-recursos.
// GET /api/cafeterias       -> lista
// GET /api/cafeterias/:id   -> detalle
router.get('/', listar);
router.get('/:id', obtenerPorId);

module.exports = router;