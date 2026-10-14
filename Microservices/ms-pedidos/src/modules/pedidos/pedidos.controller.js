'use strict';

const PedidosService = require('./pedidos.service');
const { HttpError } = require('@coffeefaster/shared');

async function crearPedido(req, res, next) {
  try {
    const resultado = await PedidosService.crearPedido({
      user: req.user,
      accessToken: req.accessToken,
      body: req.body
    });
    res.status(201).json(resultado);
  } catch (e) {
    next(e);
  }
}

async function listarPedidos(req, res, next) {
  try {
    const resultado = await PedidosService.listarPedidos({ user: req.user });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function obtenerPedido(req, res, next) {
  try {
    const resultado = await PedidosService.obtenerPedido({ user: req.user, id: req.params.id });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function obtenerPedidosPorCafeteria(req, res, next) {
  try {
    const resultado = await PedidosService.obtenerPedidosPorCafeteria({ user: req.user, cafeteriaId: req.params.cafeteriaId });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function obtenerPedidosPorUsuario(req, res, next) {
  try {
    const resultado = await PedidosService.obtenerPedidosPorUsuario({ user: req.user, usuarioId: req.params.usuarioId });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function actualizarEstado(req, res, next) {
  try {
    const resultado = await PedidosService.actualizarEstado({ user: req.user, id: req.params.id, body: req.body });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function obtenerQr(req, res, next) {
  try {
    const resultado = await PedidosService.obtenerQr({ user: req.user, id: req.params.id });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function obtenerTokenContingencia(req, res, next) {
  try {
    const resultado = await PedidosService.obtenerTokenContingencia({ user: req.user, id: req.params.id });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

async function validarQr(req, res, next) {
  try {
    const resultado = await PedidosService.validarQr({ user: req.user, body: req.body });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  obtenerPedidosPorCafeteria,
  obtenerPedidosPorUsuario,
  actualizarEstado,
  obtenerQr,
  obtenerTokenContingencia,
  validarQr
};
