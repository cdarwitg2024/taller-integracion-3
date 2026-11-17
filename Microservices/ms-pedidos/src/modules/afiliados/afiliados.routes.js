'use strict';

/**
 * Rutas del módulo de afiliados de ms-pedidos.
 *
 * Expone la consulta estudiantil, el alta, la edición y los cambios de estado. Valida el
 * cuerpo de la solicitud, delega la autorización por cafetería a la RPC
 * `administrar_campana_afiliados` y traduce sus rechazos a códigos HTTP.
 */

const router = require('express').Router();
const { auth, HttpError } = require('@coffeefaster/shared');
const crearClienteAutenticado = require('../../cliente-autenticado');

const porcentajes = ['descuento_normal_pct', 'descuento_oferta_pct', 'comision_pct'];
const camposCampana = ['nombre', ...porcentajes, 'inicio', 'fin'];
const erroresRpc = {
  sin_acceso_cafeteria: 403,
  porcentajes_fijados: 409,
  campana_finalizada: 409,
  campana_no_iniciada: 409,
  campana_invalida: 422,
};

function validarId(valor) {
  if (!/^[1-9]\d*$/.test(valor ?? '') || !Number.isSafeInteger(Number(valor))) {
    throw new HttpError(400, 'identificador_invalido');
  }
  return Number(valor);
}

function validarCambios(body, alta) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(422, 'campana_invalida');
  }
  const campos = Object.keys(body);
  const estado = !alta && campos.length === 1 && typeof body.pausada === 'boolean';
  if (estado) return body;

  if (!campos.length || (alta && campos.length !== camposCampana.length) ||
      campos.some(campo => !camposCampana.includes(campo))) {
    throw new HttpError(422, 'campana_invalida');
  }

  for (const campo of porcentajes) {
    if (Object.hasOwn(body, campo) &&
        (!Number.isFinite(body[campo]) || body[campo] < 0 || body[campo] > 100)) {
      throw new HttpError(422, 'campana_invalida');
    }
  }
  if (Object.hasOwn(body, 'nombre') &&
      (typeof body.nombre !== 'string' || !body.nombre.trim() || body.nombre.trim().length > 150)) {
    throw new HttpError(422, 'campana_invalida');
  }
  for (const campo of ['inicio', 'fin']) {
    if (Object.hasOwn(body, campo) &&
        (typeof body[campo] !== 'string' ||
         !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(body[campo]) ||
         !Number.isFinite(Date.parse(body[campo])))) {
      throw new HttpError(422, 'campana_invalida');
    }
  }
  return body;
}

function administrar(alta) {
  return async (req, res, next) => {
    try {
      const cafeteriaId = validarId(req.params.cafeteriaId);
      const campanaId = alta ? null : validarId(req.params.campanaId);
      const cambios = validarCambios(req.body, alta);
      const cliente = crearClienteAutenticado(req.accessToken);
      const { data, error } = await cliente.rpc('administrar_campana_afiliados', {
        p_cafeteria_id: cafeteriaId,
        p_campana_id: campanaId,
        p_cambios: cambios,
      });
      if (error) {
        const status = Object.hasOwn(erroresRpc, error.message) && erroresRpc[error.message];
        if (status) return res.status(status).json({ error: error.message });
        throw new HttpError(503, 'No se pudo administrar la campaña', { causa: error.code });
      }
      if (!data) throw new HttpError(503, 'La campaña no fue persistida');
      return res.status(alta ? 201 : 200).json(data);
    } catch (error) {
      if (error instanceof HttpError && error.status === 422) {
        return res.status(422).json({ error: error.message });
      }
      return next(error);
    }
  };
}

// La RPC oficial (BD 0023 + 0024) resuelve identidad, rol y vigencia.
router.get('/cafeterias/:cafeteriaId/campanas', auth.exigirAuth, async (req, res, next) => {
  try {
    const cafeteriaId = validarId(req.params.cafeteriaId);
    if (Object.keys(req.query).length) {
      throw new HttpError(400, 'parametros_no_admitidos');
    }
    const cliente = crearClienteAutenticado(req.accessToken);
    const { data, error } = await cliente.rpc('listar_oportunidades_campana', {
      p_cafeteria_id: cafeteriaId,
    });
    if (error) {
      if (error.code === '42501') throw new HttpError(403, 'estudiante_requerido');
      if (error.code === '22023') throw new HttpError(400, 'identificador_invalido');
      if (error.code === 'PGRST301' || error.code === 'PGRST303' || error.code === '28000') {
        throw new HttpError(401, 'sesion_invalida');
      }
      throw new HttpError(503, 'No se pudieron consultar las campañas');
    }
    // Un resultado inválido no debe ocultarse como una lista vacía exitosa.
    if (!Array.isArray(data)) throw new HttpError(503, 'Respuesta de campañas inválida');
    return res.status(200).json({ campanas: data });
  } catch (error) {
    return next(error);
  }
});

router.post('/cafeterias/:cafeteriaId/campanas', auth.exigirAuth, administrar(true));
router.patch('/cafeterias/:cafeteriaId/campanas/:campanaId', auth.exigirAuth, administrar(false));

module.exports = router;
