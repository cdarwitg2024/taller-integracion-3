const NotificacionesService = require('./notificaciones.service');
const DispositivosService = require('./dispositivos.service');

/**
 * POST /api/notificaciones/registro
 * Registra el token FCM del dispositivo. El usuario SIEMPRE se toma del token
 * JWT verificado, nunca del body, para que nadie pueda registrar un token
 * en nombre de otra cuenta.
 */
async function registrarDispositivo(req, res) {
  const token = req.body.token || req.body.token_fcm;
  const plataforma = req.body.plataforma || 'android';

  try {
    const dispositivo = await DispositivosService.registrarToken({
      usuario_id: req.user.id,
      token,
      plataforma
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Dispositivo registrado correctamente',
      dispositivo: {
        id: dispositivo.id,
        plataforma: dispositivo.plataforma,
        activo: dispositivo.activo,
        ultima_conexion: dispositivo.ultima_conexion
      }
    });
  } catch (error) {
    if (!token) {
      return res.status(400).json({ error: 'Se requiere el token FCM del dispositivo' });
    }
    console.error('Error al registrar dispositivo:', error.message);
    return res.status(503).json({ error: 'No se pudo registrar el dispositivo' });
  }
}

/** DELETE /api/notificaciones/registro - desregistra el token en logout. */
async function desregistrarDispositivo(req, res) {
  const token = req.body.token || req.body.token_fcm;

  if (!token) {
    return res.status(400).json({ error: 'Se requiere el token FCM del dispositivo' });
  }

  try {
    const dispositivo = await DispositivosService.desregistrarToken({
      usuario_id: req.user.id,
      token
    });

    return res.status(200).json({
      ok: true,
      mensaje: dispositivo ? 'Dispositivo desregistrado' : 'El token no estaba registrado',
      desregistrado: Boolean(dispositivo)
    });
  } catch (error) {
    console.error('Error al desregistrar dispositivo:', error.message);
    return res.status(503).json({ error: 'No se pudo desregistrar el dispositivo' });
  }
}

/** GET /api/notificaciones/estado - la app puede consultarlo para diagnostics. */
async function estadoNotificaciones(req, res) {
  try {
    return res.status(200).json({ ok: true, ...NotificacionesService.estado() });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo leer el estado de notificaciones' });
  }
}

/** POST /api/notificaciones/prueba - envío manual para validar el token. */
async function enviarPrueba(req, res) {
  try {
    const resumen = await NotificacionesService.notificarPrueba(req.user.id);

    if (resumen.total_tokens === 0) {
      return res.status(404).json({
        error: 'No hay dispositivos registrados para este usuario',
        detalle: 'Registra el token con POST /api/notificaciones/registro antes de probar'
      });
    }

    return res.status(200).json({ ok: resumen.fallidos === 0, mensaje: 'Notificación de prueba enviada', ...resumen });
  } catch (error) {
    console.error('Error en notificación de prueba:', error.message);
    return res.status(500).json({ error: 'No se pudo enviar la notificación de prueba' });
  }
}

module.exports = {
  registrarDispositivo,
  desregistrarDispositivo,
  estadoNotificaciones,
  enviarPrueba
};
