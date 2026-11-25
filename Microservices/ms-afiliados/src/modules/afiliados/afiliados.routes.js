'use strict';

/**
 * Rutas del módulo de afiliados.
 *
 * Expone la consulta estudiantil, el alta, la edición y los cambios de estado. Valida el
 * cuerpo de la solicitud, delega la autorización por cafetería a la RPC
 * `administrar_campana_afiliados` y traduce sus rechazos a códigos HTTP.
 */

const router = require('express').Router();
const { auth, HttpError } = require('@coffeefaster/shared');
const crearClienteAutenticado = require('@coffeefaster/shared/src/cliente-autenticado');

const CAMPOS_PORCENTAJE = ['descuento_normal_pct', 'descuento_oferta_pct', 'comision_pct'];
const CAMPOS_FECHA = ['inicio', 'fin'];
const CAMPOS_EDITABLES = ['nombre', 'descripcion', ...CAMPOS_PORCENTAJE, ...CAMPOS_FECHA];
const CAMPOS_OBLIGATORIOS_ALTA = ['nombre', ...CAMPOS_PORCENTAJE, ...CAMPOS_FECHA];
const PATRON_FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

const ERRORES_RPC = {
  sin_acceso_cafeteria: { status: 403, error: 'sin_acceso_cafeteria' },
  condiciones_aceptadas: { status: 409, error: 'condiciones_aceptadas' },
  porcentajes_fijados: { status: 409, error: 'porcentajes_fijados' },
  campana_finalizada: { status: 409, error: 'campana_finalizada' },
  campana_no_activa: { status: 409, error: 'campana_no_activa' },
  aceptacion_requerida: { status: 409, error: 'aceptacion_requerida' },
  campana_invalida: { status: 422, error: 'campana_invalida' },
  // El trigger V05 puede devolver estos mensajes con SQLSTATE 22023. La RPC
  // los traduce antes de responder, pero se mantiene esta defensa para no
  // convertir una regla de negocio en un 503.
  'La aceptación es inmutable; cree una nueva campaña para otras condiciones':
    { status: 409, error: 'condiciones_aceptadas' },
  'Cambiar condiciones requiere una nueva versión':
    { status: 422, error: 'campana_invalida' },
};

function validarId(valor) {
  if (!/^[1-9]\d*$/.test(valor ?? '') || !Number.isSafeInteger(Number(valor))) {
    throw new HttpError(400, 'identificador_invalido');
  }
  return Number(valor);
}

function esObjeto(valor) {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function validarPorcentaje(valor) {
  if (!Number.isFinite(valor) || valor < 0 || valor > 100 ||
      Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9) {
    throw new HttpError(422, 'campana_invalida');
  }
}

function validarFecha(valor) {
  if (typeof valor !== 'string' || !PATRON_FECHA.test(valor) ||
      !Number.isFinite(Date.parse(valor))) {
    throw new HttpError(422, 'campana_invalida');
  }
}

function validarCuerpo(body, alta) {
  if (!esObjeto(body)) throw new HttpError(422, 'campana_invalida');

  const campos = Object.keys(body);
  if (!campos.length) throw new HttpError(422, 'campana_invalida');

  const soloEstado = !alta && campos.length === 1 && Object.hasOwn(body, 'pausada');
  if (soloEstado) {
    if (typeof body.pausada !== 'boolean') throw new HttpError(422, 'campana_invalida');
    return { pausada: body.pausada };
  }

  if (Object.hasOwn(body, 'pausada') ||
      campos.some(campo => !CAMPOS_EDITABLES.includes(campo))) {
    throw new HttpError(422, 'campana_invalida');
  }

  if (alta) {
    const faltantes = CAMPOS_OBLIGATORIOS_ALTA.filter(campo => !Object.hasOwn(body, campo));
    if (faltantes.length) throw new HttpError(422, 'campana_invalida');
  }

  if (Object.hasOwn(body, 'nombre') &&
      (typeof body.nombre !== 'string' || !body.nombre.trim() ||
       body.nombre.trim().length > 150)) {
    throw new HttpError(422, 'campana_invalida');
  }

  if (Object.hasOwn(body, 'descripcion') &&
      body.descripcion !== null &&
      (typeof body.descripcion !== 'string' || body.descripcion.length > 2000)) {
    throw new HttpError(422, 'campana_invalida');
  }

  for (const campo of CAMPOS_PORCENTAJE) {
    if (Object.hasOwn(body, campo)) validarPorcentaje(body[campo]);
  }

  for (const campo of CAMPOS_FECHA) {
    if (Object.hasOwn(body, campo)) validarFecha(body[campo]);
  }

  if (Object.hasOwn(body, 'descuento_normal_pct') &&
      Object.hasOwn(body, 'descuento_oferta_pct') &&
      body.descuento_oferta_pct > body.descuento_normal_pct) {
    throw new HttpError(422, 'campana_invalida');
  }

  if (Object.hasOwn(body, 'inicio') && Object.hasOwn(body, 'fin') &&
      Date.parse(body.inicio) >= Date.parse(body.fin)) {
    throw new HttpError(422, 'campana_invalida');
  }

  return body;
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function estadoExterno(fila, ahora) {
  const estadoDb = String(fila.estado || '').trim().toLowerCase();
  const inicio = Date.parse(fila.vigencia_desde);
  const fin = Date.parse(fila.vigencia_hasta);

  if (estadoDb === 'finalizada' || (Number.isFinite(fin) && ahora >= fin)) return 'finalizada';
  if (estadoDb === 'pausada') return 'pausada';
  if (estadoDb === 'activa' || estadoDb === 'aceptada') {
    if (!Number.isFinite(inicio)) return estadoDb;
    return ahora < inicio ? 'programada' : 'activa';
  }
  if (estadoDb === 'borrador' || estadoDb === 'pendiente_aceptacion') return 'programada';
  return estadoDb || 'programada';
}

/**
 * Conserva las columnas que lee escritorio y agrega los alias de C02.
 * `estado_db` deja visible el estado real de public.campanas; `estado` es la
 * vista externa del contrato, donde C02 usa "programada" para una campaña
 * creada pero aún no activa.
 */
function mapearCampana(fila, ahora = Date.now()) {
  if (!esObjeto(fila)) return fila;

  const tasaDescuento = numero(fila.tasa_descuento);
  const tasaOferta = numero(fila.tasa_descuento_oferta);
  const tasaComision = numero(fila.tasa_comision);

  return {
    ...fila,
    estado: estadoExterno(fila, ahora),
    estado_db: fila.estado ?? null,
    tasa_descuento: tasaDescuento,
    tasa_descuento_oferta: tasaOferta,
    tasa_comision: tasaComision,
    descuento_normal_pct: tasaDescuento,
    descuento_oferta_pct: tasaOferta,
    comision_pct: tasaComision,
    inicio: fila.vigencia_desde ?? null,
    fin: fila.vigencia_hasta ?? null,
  };
}

function traducirErrorRpc(error) {
  const mensaje = typeof error?.message === 'string' ? error.message : '';
  const clave = Object.keys(ERRORES_RPC).find(nombre => mensaje === nombre) ??
    Object.keys(ERRORES_RPC).find(nombre => mensaje.includes(nombre));
  if (!clave) return null;
  return {
    status: ERRORES_RPC[clave].status,
    body: { error: ERRORES_RPC[clave].error },
  };
}

function clienteAutenticado(req) {
  return crearClienteAutenticado(req.accessToken);
}

function administrar(alta) {
  return async (req, res, next) => {
    try {
      const cafeteriaId = validarId(req.params.cafeteriaId);
      const campanaId = alta ? null : validarId(req.params.campanaId);
      const cambios = validarCuerpo(req.body, alta);
      const { data, error } = await clienteAutenticado(req).rpc('administrar_campana_afiliados', {
        p_cafeteria_id: cafeteriaId,
        p_campana_id: campanaId,
        p_cambios: cambios,
      });

      if (error) {
        const respuesta = traducirErrorRpc(error);
        if (respuesta) return res.status(respuesta.status).json(respuesta.body);
        throw new HttpError(503, 'No se pudo administrar la campaña', { causa: error.code });
      }
      if (!esObjeto(data)) throw new HttpError(503, 'La campaña no fue persistida');

      return res.status(alta ? 201 : 200).json(mapearCampana(data));
    } catch (error) {
      if (error instanceof HttpError && error.status === 422) {
        return res.status(422).json({ error: error.message });
      }
      return next(error);
    }
  };
}

router.get('/cafeterias/:cafeteriaId/campanas/administracion', auth.exigirAuth, async (req, res, next) => {
  try {
    const cafeteriaId = validarId(req.params.cafeteriaId);
    const { data, error } = await clienteAutenticado(req).rpc('listar_campanas_afiliados', {
      p_cafeteria_id: cafeteriaId,
    });

    if (error) {
      const respuesta = traducirErrorRpc(error);
      if (respuesta) return res.status(respuesta.status).json(respuesta.body);
      throw new HttpError(503, 'No se pudieron listar las campañas', { causa: error.code });
    }
    if (data !== null && !Array.isArray(data)) {
      throw new HttpError(503, 'La lista de campañas no tiene el formato esperado');
    }

    return res.status(200).json({ campanas: (data || []).map(fila => mapearCampana(fila)) });
  } catch (error) {
    return next(error);
  }
});

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

router.get('/saldo', auth.exigirAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (Object.keys(req.query).length) {
      throw new HttpError(400, 'parametros_no_admitidos');
    }

    const { data, error, status } = await clienteAutenticado(req).rpc('consultar_saldo_afiliado');
    if (status === 401 || ['PGRST301', 'PGRST303', '28000'].includes(error?.code)) {
      throw new HttpError(401, 'sesion_invalida');
    }
    if (status === 403 || error?.code === '42501') throw new HttpError(403, 'estudiante_requerido');
    if (error || status >= 400) throw new HttpError(503, 'No se pudo consultar el saldo');

    const saldo = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!esObjeto(saldo)) throw new HttpError(503, 'Respuesta de saldo inválida');

    const { pendiente_clp, disponible_clp, retirado_clp } = saldo;
    if (![pendiente_clp, disponible_clp, retirado_clp].every(Number.isFinite)) {
      throw new HttpError(503, 'Respuesta de saldo inválida');
    }

    return res.status(200).json({ pendiente_clp, disponible_clp, retirado_clp });
  } catch (error) {
    return next(error);
  }
});

router.post('/retiros', auth.exigirAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (Object.keys(req.query).length || !esObjeto(req.body) ||
        Object.keys(req.body).some(campo => !['monto_clp', 'clave_idempotencia'].includes(campo))) {
      throw new HttpError(400, 'parametros_no_admitidos');
    }

    const { monto_clp, clave_idempotencia } = req.body;
    if (!Number.isSafeInteger(monto_clp) || monto_clp <= 0) {
      throw new HttpError(422, 'monto_invalido');
    }
    if (typeof clave_idempotencia !== 'string' || !clave_idempotencia.trim() ||
        clave_idempotencia.includes('\0') || Buffer.byteLength(clave_idempotencia) > 128) {
      throw new HttpError(422, 'clave_idempotencia_invalida');
    }

    const { data, error, status } = await clienteAutenticado(req).rpc('registrar_retiro_simulado', {
      p_monto_clp: monto_clp,
      p_clave_idempotencia: clave_idempotencia,
    });
    if (status === 401 || ['PGRST301', 'PGRST303', '28000'].includes(error?.code)) {
      throw new HttpError(401, 'sesion_invalida');
    }
    if (status === 403 || error?.code === '42501') throw new HttpError(403, 'estudiante_requerido');
    if (error || status >= 400) throw new HttpError(503, 'No se pudo registrar el retiro');

    if (data?.ok === false) {
      if (data.motivo === 'conflicto_idempotencia') throw new HttpError(409, data.motivo);
      if (['saldo_insuficiente', 'monto_invalido', 'clave_idempotencia_invalida'].includes(data.motivo)) {
        throw new HttpError(422, data.motivo);
      }
    }
    if (data?.ok !== true || data.estado !== 'confirmado' || data.monto_clp !== monto_clp ||
        typeof data.referencia !== 'string' || !data.referencia ||
        typeof data.destino !== 'string' || !data.destino ||
        !Number.isFinite(data.disponible_clp) || data.disponible_clp < 0) {
      throw new HttpError(503, 'Respuesta de retiro inválida');
    }

    const { estado, referencia, destino, disponible_clp } = data;
    return res.status(200).json({ monto_clp, estado, referencia, destino, disponible_clp });
  } catch (error) {
    return next(error);
  }
});

router.use(require('./solicitudes.routes')({ validarId, esObjeto }));
router.use(require('./cotizaciones.routes'));

module.exports = router;
