// Servicio de campañas de afiliados del dueño. Implementa el contrato C02
// (/api/afiliados/cafeterias/:id/campanas) reutilizando el cliente del gateway.
import { BASE_BACKEND, request } from './backendApi';

// Ruta base del contrato de campañas de una cafetería.
const ruta = (cafeteriaId, sufijo = '') =>
  `${BASE_BACKEND}/api/afiliados/cafeterias/${Number(cafeteriaId)}/campanas${sufijo}`;

// Códigos del contrato C05 que necesitan una explicación para el dueño.
const MENSAJES_C05 = {
  codigo_en_uso: 'Ese código ya está en uso. Elige otro.',
  sin_acceso_cafeteria: 'No tienes acceso a las solicitudes de esta cafetería.',
};

// Traduce los errores del contrato C05 antes de mostrarlos en el panel.
function explicarErrorC05(error) {
  return new Error(MENSAJES_C05[error.message] || error.message);
}

// Devuelve los errores por campo del formulario, sin alterar los valores válidos.
export function validarFormularioCampana(form = {}, esAlta = false) {
  const errores = {};
  const nombre = String(form.nombre || '').trim();
  if (nombre.length < 3 || nombre.length > 120) {
    errores.nombre = 'El nombre debe tener entre 3 y 120 caracteres.';
  }
  const inicio = parsearFecha(form.inicio);
  const fin = parsearFecha(form.fin);
  if (inicio.error) errores.inicio = inicio.error;
  else if (esAlta && !inicio.valor) errores.inicio = 'El inicio es obligatorio en el alta.';
  if (fin.error) errores.fin = fin.error;
  else if (esAlta && !fin.valor) errores.fin = 'El término es obligatorio en el alta.';
  if (!inicio.error && !fin.error && inicio.valor && fin.valor && fin.valor <= inicio.valor) {
    errores.fin = 'El término debe ser posterior al inicio.';
  }
  const porcentaje = (valor, etiqueta, campo, obligatorio = 'obligatorio') => {
    if (typeof valor === 'boolean' || (typeof valor === 'string' && valor.trim() === '')) {
      errores[campo] = `${etiqueta} es ${obligatorio}.`;
      return;
    }
    if (valor === '' || valor === null || valor === undefined) {
      errores[campo] = `${etiqueta} es ${obligatorio}.`;
      return;
    }
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errores[campo] = `${etiqueta} debe estar entre 0 y 100.`;
    } else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-9) {
      errores[campo] = `${etiqueta} debe tener hasta dos decimales.`;
    }
    return n;
  };
  const descuentoNormal = porcentaje(form.descuento_normal_pct, 'El descuento a precio normal', 'descuento_normal_pct');
  const descuentoOferta = porcentaje(form.descuento_oferta_pct, 'El descuento en oferta', 'descuento_oferta_pct');
  porcentaje(form.comision_pct, 'La comisión', 'comision_pct', 'obligatoria');
  if (Number.isFinite(descuentoNormal) && Number.isFinite(descuentoOferta) && descuentoOferta > descuentoNormal) {
    errores.descuento_oferta_pct = 'El descuento en oferta no puede superar el descuento a precio normal.';
  }
  return { errores, nombre, inicio: inicio.valor, fin: fin.valor };
}

function parsearFecha(valor) {
  if (valor === '' || valor === null || valor === undefined) return { valor: null, error: '' };
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(valor)) {
    return { valor: null, error: 'Revisa la fecha de vigencia.' };
  }
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) return { valor: null, error: 'Revisa la fecha de vigencia.' };
  const [year, month, day, hour, minute] = valor.slice(0, 16).split(/[-T:]/).map(Number);
  const calendario = new Date(Date.UTC(year, month - 1, day));
  if (calendario.getUTCFullYear() !== year || calendario.getUTCMonth() !== month - 1
    || calendario.getUTCDate() !== day || hour > 23 || minute > 59) {
    return { valor: null, error: 'Revisa la fecha de vigencia.' };
  }
  return { valor: fecha, error: '' };
}

// Valida el formulario del panel y lo convierte al cuerpo del contrato.
export function prepararCampana(form, esAlta = false) {
  const { errores, nombre, inicio, fin } = validarFormularioCampana(form, esAlta);
  const primerCampo = Object.keys(errores)[0];
  if (primerCampo) throw new Error(errores[primerCampo]);
  const cuerpo = {
    nombre,
    descuento_normal_pct: Number(form.descuento_normal_pct),
    descuento_oferta_pct: Number(form.descuento_oferta_pct),
    comision_pct: Number(form.comision_pct),
  };
  if (inicio) cuerpo.inicio = inicio.toISOString();
  if (fin) cuerpo.fin = fin.toISOString();
  return cuerpo;
}

export const campanasAfiliados = {
  // GET /api/afiliados/cafeterias/:id/campanas/administracion (solo dueño)
  async listar(cafeteriaId) {
    let body;
    try {
      body = await request(ruta(cafeteriaId, '/administracion'));
    } catch (error) {
      throw explicarErrorC05(error);
    }
    return Array.isArray(body?.campanas) ? body.campanas : [];
  },
  // POST /api/afiliados/cafeterias/:id/campanas
  async crear(cafeteriaId, form) {
    return request(ruta(cafeteriaId), { method: 'POST', body: JSON.stringify(prepararCampana(form, true)) });
  },
  // PATCH /api/afiliados/cafeterias/:id/campanas/:campanaId
  async actualizar(cafeteriaId, campanaId, form) {
    return request(ruta(cafeteriaId, `/${Number(campanaId)}`), {
      method: 'PATCH',
      body: JSON.stringify(prepararCampana(form)),
    });
  },
  // GET .../:campanaId/solicitudes; sigue el cursor hasta agotar la paginación.
  async listarSolicitudes(cafeteriaId, campanaId) {
    const base = ruta(cafeteriaId, `/${Number(campanaId)}/solicitudes`);
    const solicitudes = [];
    let antesDe = null;
    for (;;) {
      const url = antesDe === null ? base : `${base}?antes_de=${encodeURIComponent(antesDe)}`;
      let body;
      try {
        body = await request(url);
      } catch (error) {
        throw explicarErrorC05(error);
      }
      if (!Array.isArray(body?.solicitudes) ||
          body.solicitudes.some(s => !Number.isSafeInteger(s?.id) || s.id <= 0)) {
        throw new Error('Respuesta de solicitudes inválida.');
      }
      solicitudes.push(...body.solicitudes);
      const siguiente = body.siguiente_antes_de;
      if (siguiente === undefined || siguiente === null) return solicitudes;
      if (!Number.isSafeInteger(siguiente) || siguiente <= 0 || (antesDe !== null && siguiente >= antesDe)) {
        throw new Error('Paginación de solicitudes inválida.');
      }
      antesDe = siguiente;
    }
  },
  // PATCH .../:campanaId/solicitudes/:solicitudId con la decisión del dueño.
  async resolverSolicitud(cafeteriaId, campanaId, solicitudId, decision, codigo) {
    if (!['aprobar', 'rechazar', 'desactivar'].includes(decision)) {
      throw new Error('Decisión no válida.');
    }
    const cuerpo = { decision };
    if (decision === 'aprobar') {
      // El contrato permite omitirlo: la RPC genera el código cuando no se propone uno.
      const asignado = String(codigo ?? '').trim();
      if (asignado) cuerpo.codigo = asignado;
    }
    try {
      return await request(ruta(cafeteriaId, `/${Number(campanaId)}/solicitudes/${Number(solicitudId)}`), {
        method: 'PATCH',
        body: JSON.stringify(cuerpo),
      });
    } catch (error) {
      throw explicarErrorC05(error);
    }
  },
};
