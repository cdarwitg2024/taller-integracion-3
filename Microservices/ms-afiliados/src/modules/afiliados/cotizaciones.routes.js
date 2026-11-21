'use strict';

const router = require('express').Router();
const { auth, HttpError } = require('@coffeefaster/shared');
const crearClienteAutenticado = require('@coffeefaster/shared/src/cliente-autenticado');

router.post('/cotizaciones', auth.exigirAuth, async (req, res, next) => {
  if (process.env.HABILITAR_CONFIRMACION_AFILIADA !== 'true') {
    return res.status(503).json({ error: 'cotizacion_afiliada_no_disponible' });
  }

  try {
    const { cafeteria_id, items, codigo = null } = req.body || {};
    if (!Number.isSafeInteger(cafeteria_id) || cafeteria_id <= 0 ||
        !Array.isArray(items) || items.length < 1 || items.length > 100 ||
        (codigo !== null && typeof codigo !== 'string')) {
      throw new HttpError(400, 'carrito_invalido');
    }

    const { data, error } = await crearClienteAutenticado(req.accessToken).rpc(
      'cotizar_carrito_afiliado',
      { p_cafeteria_id: cafeteria_id, p_items: items, p_codigo: codigo }
    );
    if (error) {
      if (error.code === '22023') throw new HttpError(400, 'carrito_invalido');
      if (error.code === '42501') throw new HttpError(403, 'sin_acceso');
      if (['PGRST301', 'PGRST303', '28000'].includes(error.code)) {
        throw new HttpError(401, 'sesion_invalida');
      }
      throw new HttpError(503, 'No se pudo cotizar');
    }

    const fila = data?.[0];
    if (!Array.isArray(data) || data.length !== 1 ||
        ![fila?.subtotal, fila?.descuento_afiliado, fila?.total].every(
          monto => Number.isSafeInteger(monto) && monto >= 0
        ) || (fila.motivo !== null && typeof fila.motivo !== 'string')) {
      throw new HttpError(503, 'Respuesta de cotización inválida');
    }
    const { subtotal, descuento_afiliado, total, motivo } = fila;
    if (motivo !== null && motivo !== 'sin_codigo') {
      return res.status(422).json({ error: motivo });
    }
    return res.json({ subtotal, descuento_afiliado, total });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
