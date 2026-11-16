'use strict';

/**
 * Rutas del módulo de afiliados de ms-pedidos.
 *
 * Expone la administración de campañas sobre public.campanas, la tabla que
 * consume escritorio. El contrato externo conserva los nombres de C02
 * (descuento_normal_pct, descuento_oferta_pct, comision_pct, inicio y fin) y
 * los traduce a las columnas reales (tasa_descuento, tasa_descuento_oferta,
 * tasa_comision, vigencia_desde y vigencia_hasta).
 *
 * La autorización no se resuelve en Express: la RPC
 * `administrar_campana_afiliados` recibe el JWT del usuario, comprueba
 * `auth.uid()` y `dueno_campana_id(p_cafeteria_id)`, y limita la fila por
 * campaña y cafetería. `listar_campanas_afiliados` aplica el mismo alcance al
 * listado administrativo. No se usa service_role.
 */

const router = require('express').Router();
const { auth, HttpError } = require('@coffeefaster/shared');
const crearClienteAutenticado = require('../../cliente-autenticado');

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

async function listar(req, res, next) {
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
    const campanas = (data || []).map(fila => mapearCampana(fila));
    return res.status(200).json({ campanas });
  } catch (error) {
    return next(error);
  }
}

// Listado administrativo del dueño. No es el listado estudiantil de C04.
router.get('/cafeterias/:cafeteriaId/campanas', auth.exigirAuth, listar);
router.post('/cafeterias/:cafeteriaId/campanas', auth.exigirAuth, administrar(true));
router.patch('/cafeterias/:cafeteriaId/campanas/:campanaId', auth.exigirAuth, administrar(false));

module.exports = router;
