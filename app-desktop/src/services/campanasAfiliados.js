// Servicio de campañas de afiliados del dueño. Implementa el contrato C02
// (/api/afiliados/cafeterias/:id/campanas) reutilizando el cliente del gateway.
import { BASE_BACKEND, request } from './backendApi';

// Ruta base del contrato de campañas de una cafetería.
const ruta = (cafeteriaId, sufijo = '') =>
  `${BASE_BACKEND}/api/afiliados/cafeterias/${Number(cafeteriaId)}/campanas${sufijo}`;

// Valida el formulario del panel y lo convierte al cuerpo del contrato.
export function prepararCampana(form) {
  const nombre = String(form.nombre || '').trim();
  if (nombre.length < 3 || nombre.length > 120) {
    throw new Error('El nombre debe tener entre 3 y 120 caracteres.');
  }
  const porcentaje = (valor, etiqueta) => {
    if (valor === '' || valor === null || valor === undefined) {
      throw new Error(`${etiqueta} es obligatorio.`);
    }
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error(`${etiqueta} debe estar entre 0 y 100.`);
    }
    return n;
  };
  const inicio = form.inicio ? new Date(form.inicio) : null;
  const fin = form.fin ? new Date(form.fin) : null;
  if ([inicio, fin].some(d => d && !Number.isFinite(d.getTime()))) {
    throw new Error('Revisa las fechas de vigencia.');
  }
  if (inicio && fin && fin <= inicio) {
    throw new Error('El término debe ser posterior al inicio.');
  }
  return {
    nombre,
    descuento_normal_pct: porcentaje(form.descuento_normal_pct, 'El descuento a precio normal'),
    descuento_oferta_pct: porcentaje(form.descuento_oferta_pct, 'El descuento en oferta'),
    comision_pct: porcentaje(form.comision_pct, 'La comisión'),
    inicio: inicio?.toISOString() || null,
    fin: fin?.toISOString() || null,
  };
}

export const campanasAfiliados = {
  // GET /api/afiliados/cafeterias/:id/campanas
  async listar(cafeteriaId) {
    const body = await request(ruta(cafeteriaId));
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
