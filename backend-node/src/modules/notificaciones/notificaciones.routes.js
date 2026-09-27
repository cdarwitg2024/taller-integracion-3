const express = require('express');
const { autenticarToken } = require('../auth/auth.middleware');
const {
  registrarDispositivo,
  desregistrarDispositivo,
  estadoNotificaciones,
  enviarPrueba
} = require('./notificaciones.controller');

const router = express.Router();

// Todas las rutas requieren JWT: el usuario sale del token verificado.
router.post('/registro', autenticarToken, registrarDispositivo);
router.delete('/registro', autenticarToken, desregistrarDispositivo);
router.get('/estado', autenticarToken, estadoNotificaciones);
router.post('/prueba', autenticarToken, enviarPrueba);

module.exports = router;
