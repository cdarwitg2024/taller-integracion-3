import { apiGet } from './backendClient';

export type CafeteriaAfiliados = { id: number; nombre: string };
export type CampanaAfiliados = {
  id: number;
  nombre: string;
  cafeteria_id: number;
  cafeteria_nombre: string;
  tipo: string;
  estado: string;
  estado_vigencia: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  tasa_descuento: number | null;
  tasa_comision: number | null;
};

function idValido(valor: unknown): number {
  const id = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Identificador de cafetería o campaña inválido.');
  return id;
}

function porcentaje(valor: unknown): number | null {
  if (valor === null) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new Error('La respuesta de campañas no tiene porcentajes válidos.');
  }
  return valor;
}

function campanaValida(valor: any, cafeteriaId: number): CampanaAfiliados {
  if (!valor || typeof valor.nombre !== 'string' || !valor.nombre.trim() ||
      typeof valor.cafeteria_nombre !== 'string' || !valor.cafeteria_nombre.trim() ||
      typeof valor.tipo !== 'string' || !valor.tipo.trim() ||
      typeof valor.estado !== 'string' || typeof valor.estado_vigencia !== 'string' ||
      typeof valor.vigencia_desde !== 'string' || typeof valor.vigencia_hasta !== 'string' ||
      !Number.isFinite(Date.parse(valor.vigencia_desde)) || !Number.isFinite(Date.parse(valor.vigencia_hasta)) ||
      Date.parse(valor.vigencia_hasta) <= Date.parse(valor.vigencia_desde) ||
      idValido(valor.cafeteria_id) !== cafeteriaId) {
    throw new Error('La respuesta de campañas no es válida para esta cafetería.');
  }
  return {
    id: idValido(valor.id), nombre: valor.nombre.trim(), estado: valor.estado,
    cafeteria_id: cafeteriaId, cafeteria_nombre: valor.cafeteria_nombre.trim(),
    tipo: valor.tipo, estado_vigencia: valor.estado_vigencia,
    vigencia_desde: valor.vigencia_desde, vigencia_hasta: valor.vigencia_hasta,
    tasa_descuento: porcentaje(valor.tasa_descuento),
    tasa_comision: porcentaje(valor.tasa_comision),
  };
}

// A03 muestra campañas activas vigentes; no confunde postulación anticipada con vigencia.
export function filtrarCampanasActivas(campanas: CampanaAfiliados[], ahora = Date.now()): CampanaAfiliados[] {
  return campanas.filter(c => c.estado === 'activa' && c.estado_vigencia === 'en_curso'
    && Date.parse(c.vigencia_desde) <= ahora && ahora < Date.parse(c.vigencia_hasta));
}

export async function listarCafeteriasAfiliados(): Promise<CafeteriaAfiliados[]> {
  const respuesta = await apiGet<{ data: any[] }>('/api/cafeterias', { publico: true });
  if (!Array.isArray(respuesta?.data)) throw new Error('La respuesta de cafeterías no es válida.');
  return respuesta.data.map(c => {
    if (!c || typeof c.nombre !== 'string' || !c.nombre.trim()) throw new Error('La respuesta de cafeterías no es válida.');
    return { id: idValido(c.id), nombre: c.nombre.trim() };
  });
}

export async function listarCampanasActivas(cafeteriaId: number): Promise<CampanaAfiliados[]> {
  const id = idValido(cafeteriaId);
  // Sesión actual de apiGet; nunca se usa la ruta administrativa del dueño.
  const respuesta = await apiGet<{ campanas: unknown[] }>(`/api/afiliados/cafeterias/${id}/campanas`);
  if (!Array.isArray(respuesta?.campanas)) throw new Error('La respuesta de campañas no es válida.');
  return filtrarCampanasActivas(respuesta.campanas.map(c => campanaValida(c, id)));
}
