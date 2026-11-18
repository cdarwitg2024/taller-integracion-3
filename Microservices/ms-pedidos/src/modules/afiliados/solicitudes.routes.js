'use strict';

const { Router } = require('express');
const { auth, HttpError } = require('@coffeefaster/shared');
const crearClienteAutenticado = require('../../cliente-autenticado');

const SOLICITUDES = '/cafeterias/:cafeteriaId/campanas/:campanaId/solicitudes';
const ERRORES_SQL = {
  '42501': [403, 'sin_acceso_cafeteria'],
  '22023': [422, 'solicitud_invalida'],
  '23505': [409, 'codigo_en_uso'],
  '28000': [401, 'sesion_invalida'],
  PGRST301: [401, 'sesion_invalida'],
  PGRST303: [401, 'sesion_invalida'],
};

async function ejecutar(req, rpc, args, conflicto = 'resolucion_en_conflicto') {
  const { data, error } = await crearClienteAutenticado(req.accessToken).rpc(rpc, args);
  if (!error) return data;
  if (error.code === '55000') throw new HttpError(409, conflicto);
  if (error.code === '42501' && error.message === 'estudiante_requerido') {
    throw new HttpError(403, 'estudiante_requerido');
  }
  if (Object.hasOwn(ERRORES_SQL, error.code)) throw new HttpError(...ERRORES_SQL[error.code]);
  throw new HttpError(503, 'No se pudo gestionar la afiliación', { causa: error.code });
}

function presentar(fila) {
  if (!Number.isSafeInteger(fila?.id) || fila.id <= 0 ||
      !['pendiente', 'rechazada', 'aprobada'].includes(fila.estado)) {
    throw new HttpError(503, 'Respuesta de afiliación inválida');
  }
  const { id, estado, codigo, codigo_activo } = fila;
  if (estado !== 'aprobada') return { id, estado };
  if (typeof codigo !== 'string' || !codigo || typeof codigo_activo !== 'boolean') {
    throw new HttpError(503, 'Respuesta de afiliación inválida');
  }
  return { id, estado, codigo, codigo_activo };
}

function presentarLista(filas, transformar) {
  if (!Array.isArray(filas)) throw new HttpError(503, 'Respuesta de afiliación inválida');
  return { solicitudes: filas.map(transformar) };
}

function conSesion(manejar) {
  return [auth.exigirAuth, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length) throw new HttpError(400, 'parametros_no_admitidos');
      res.set('Cache-Control', 'no-store');
      await manejar(req, res);
    } catch (error) {
      next(error);
    }
  }];
}

module.exports = function solicitudesRoutes({ validarId, esObjeto }) {
  const router = Router();
  const ambito = req => ({
    p_cafeteria_id: validarId(req.params.cafeteriaId),
    p_campana_id: validarId(req.params.campanaId),
  });

  router.post(SOLICITUDES, conSesion(async (req, res) => {
    const ids = ambito(req);
    if (!esObjeto(req.body) || typeof req.body.plan_promocion !== 'string' || !req.body.plan_promocion.trim()) {
      throw new HttpError(422, 'plan_promocion_requerido');
    }
    const { plan_promocion, enlace_publico = null } = req.body;
    if (Object.keys(req.body).some(campo => !['plan_promocion', 'enlace_publico'].includes(campo)) ||
        (enlace_publico !== null && typeof enlace_publico !== 'string')) {
      throw new HttpError(422, 'solicitud_invalida');
    }
    const data = await ejecutar(req, 'crear_solicitud_afiliacion', {
      ...ids, p_plan_promocion: plan_promocion.trim(), p_enlace_publico: enlace_publico?.trim() || null,
    }, 'campana_no_disponible');
    if (typeof data?.creada !== 'boolean') throw new HttpError(503, 'Respuesta de afiliación inválida');
    res.status(data.creada ? 201 : 200).json(presentar(data.solicitud));
  }));

  router.get(SOLICITUDES, conSesion(async (req, res) => {
    const data = await ejecutar(req, 'listar_solicitudes_afiliacion', ambito(req));
    res.json(presentarLista(data, fila => ({
      ...presentar(fila), solicitante: fila.solicitante,
      plan_promocion: fila.plan_promocion, enlace_publico: fila.enlace_publico,
    })));
  }));

  router.patch(`${SOLICITUDES}/:solicitudId`, conSesion(async (req, res) => {
    const ids = ambito(req);
    const solicitudId = validarId(req.params.solicitudId);
    if (!esObjeto(req.body) || Object.keys(req.body).some(campo => !['decision', 'codigo'].includes(campo))) {
      throw new HttpError(422, 'solicitud_invalida');
    }
    const { decision, codigo = null } = req.body;
    if (!['aprobar', 'rechazar', 'desactivar'].includes(decision) ||
        (codigo !== null && (decision !== 'aprobar' || typeof codigo !== 'string'))) {
      throw new HttpError(422, 'solicitud_invalida');
    }
    const data = await ejecutar(req, 'resolver_solicitud_afiliacion_campana', {
      ...ids, p_solicitud_id: solicitudId, p_decision: decision, p_codigo: codigo,
    });
    res.json(presentar(data));
  }));

  router.get('/mi-perfil', conSesion(async (req, res) => {
    const data = await ejecutar(req, 'consultar_mis_solicitudes_afiliacion');
    res.json(presentarLista(data, fila => ({
      ...presentar(fila), cafeteria_id: fila.cafeteria_id, campana_id: fila.campana_id,
    })));
  }));

  return router;
};
