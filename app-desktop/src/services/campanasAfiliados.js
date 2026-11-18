// Servicio de campañas de afiliados del dueño. Implementa el contrato C02
// (/api/afiliados/cafeterias/:id/campanas) reutilizando el cliente del gateway.
import { BASE_BACKEND, request } from './backendApi';

// Ruta base del contrato de campañas de una cafetería.
const ruta = (cafeteriaId, sufijo = '') =>
  `${BASE_BACKEND}/api/afiliados/cafeterias/${Number(cafeteriaId)}/campanas${sufijo}`;

// Devuelve los errores por campo del formulario, sin alterar los valores válidos.
export function validarFormularioCampana(form = {}) {
  const errores = {};
  const nombre = String(form.nombre || '').trim();
  if (nombre.length < 3 || nombre.length > 120) {
    errores.nombre = 'El nombre debe tener entre 3 y 120 caracteres.';
  }
  const inicio = parsearFecha(form.inicio);
  const fin = parsearFecha(form.fin);
  if (inicio.error) errores.inicio = inicio.error;
  if (fin.error) errores.fin = fin.error;
  if (!inicio.error && !fin.error && inicio.valor && fin.valor && fin.valor <= inicio.valor) {
    errores.fin = 'El término debe ser posterior al inicio.';
  }
  const porcentaje = (valor, etiqueta, campo) => {
    if (typeof valor === 'boolean' || (typeof valor === 'string' && valor.trim() === '')) {
      errores[campo] = `${etiqueta} es obligatorio.`;
      return;
    }
    if (valor === '' || valor === null || valor === undefined) {
      errores[campo] = `${etiqueta} es obligatorio.`;
      return;
    }
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errores[campo] = `${etiqueta} debe estar entre 0 y 100.`;
    }
    return n;
  };
  porcentaje(form.descuento_normal_pct, 'El descuento a precio normal', 'descuento_normal_pct');
  porcentaje(form.descuento_oferta_pct, 'El descuento en oferta', 'descuento_oferta_pct');
  porcentaje(form.comision_pct, 'La comisión', 'comision_pct');
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
export function prepararCampana(form) {
  const { errores, nombre, inicio, fin } = validarFormularioCampana(form);
  const primerCampo = Object.keys(errores)[0];
  if (primerCampo) throw new Error(errores[primerCampo]);
  return {
    nombre,
    descuento_normal_pct: Number(form.descuento_normal_pct),
    descuento_oferta_pct: Number(form.descuento_oferta_pct),
    comision_pct: Number(form.comision_pct),
    inicio: inicio?.toISOString() || null,
    fin: fin?.toISOString() || null,
  };
}

export const campanasAfiliados = {
  // GET /api/afiliados/cafeterias/:id/campanas/administracion (solo dueño)
  async listar(cafeteriaId) {
    const body = await request(ruta(cafeteriaId, '/administracion'));
    return Array.isArray(body?.campanas) ? body.campanas : [];
  },
  // POST /api/afiliados/cafeterias/:id/campanas
  async crear(cafeteriaId, form) {
    return request(ruta(cafeteriaId), { method: 'POST', body: JSON.stringify(prepararCampana(form)) });
  },
  // PATCH /api/afiliados/cafeterias/:id/campanas/:campanaId
  async actualizar(cafeteriaId, campanaId, form) {
    return request(ruta(cafeteriaId, `/${Number(campanaId)}`), {
      method: 'PATCH',
      body: JSON.stringify(prepararCampana(form)),
    });
  },
};
