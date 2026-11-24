import { apiGet, apiPost } from './backendClient';
import { supabase } from '../lib/supabase';
import { leerConRenovacion } from '../lib/sesion';

export type SolicitudAfiliacion = {
  id: number; cafeteria_id: number; campana_id: number;
  estado: 'pendiente' | 'rechazada' | 'aprobada';
  codigo?: string; codigo_activo?: boolean;
};
export type MovimientoComision = {
  id: number; afiliacion_id: number; pedido_id: number;
  tipo: 'comision' | 'reversion'; estado: 'pendiente' | 'disponible' | 'revertida';
  monto_clp: number; creado_en: string;
};
const id = (valor: unknown): number => {
  const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new Error('Identificador de afiliación inválido.');
  return numero;
};
function solicitud(fila: any): SolicitudAfiliacion {
  if (!fila || !['pendiente', 'rechazada', 'aprobada'].includes(fila.estado)) {
    throw new Error('La respuesta de afiliación no es válida.');
  }
  const resultado: SolicitudAfiliacion = {
    id: id(fila.id), cafeteria_id: id(fila.cafeteria_id), campana_id: id(fila.campana_id), estado: fila.estado,
  };
  if (fila.estado === 'aprobada') {
    if (typeof fila.codigo !== 'string' || !fila.codigo.trim() || typeof fila.codigo_activo !== 'boolean') {
      throw new Error('La aprobación no incluye un código y estado válidos.');
    }
    resultado.codigo = fila.codigo;
    resultado.codigo_activo = fila.codigo_activo;
  }
  return resultado;
}
export async function consultarAfiliaciones(): Promise<SolicitudAfiliacion[]> {
  const filas: SolicitudAfiliacion[] = [];
  const vistos = new Set<number>();
  const ambitos = new Set<string>();
  let cursor: number | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const ruta = '/api/afiliados/mi-perfil' + (cursor === undefined ? '' : `?antes_de=${cursor}`);
    const respuesta = await apiGet<{ solicitudes: unknown[]; siguiente_antes_de?: unknown }>(ruta);
    if (!Array.isArray(respuesta?.solicitudes)) throw new Error('La respuesta de solicitudes no es válida.');
    const lote = respuesta.solicitudes.map(solicitud);
    for (const fila of lote) {
      const ambito = `${fila.cafeteria_id}:${fila.campana_id}`;
      if (vistos.has(fila.id) || ambitos.has(ambito) || (cursor !== undefined && fila.id >= cursor)) {
        throw new Error('La respuesta contiene solicitudes duplicadas o fuera de página.');
      }
      vistos.add(fila.id);
      ambitos.add(ambito);
      filas.push(fila);
    }
    if (respuesta.siguiente_antes_de === undefined) return filas;
    const siguiente = respuesta.siguiente_antes_de;
    if (typeof siguiente !== 'number' || !Number.isSafeInteger(siguiente) || siguiente <= 0 ||
        !lote.length || siguiente !== lote[lote.length - 1].id ||
        (cursor !== undefined && siguiente >= cursor)) {
      throw new Error('La continuación de solicitudes no es válida.');
    }
    cursor = siguiente;
  }
  throw new Error('No se pudieron cargar todas las solicitudes. No se muestra un perfil parcial.');
}
export async function solicitarAfiliacion(cafeteriaId: number, campanaId: number, plan: string, enlace = '') {
  const cafeteria = id(cafeteriaId), campana = id(campanaId);
  if (typeof plan !== 'string' || !plan.trim()) throw new Error('Explica cómo promocionarás la campaña.');
  if (enlace.trim()) {
    let valido = false;
    try { valido = ['http:', 'https:'].includes(new URL(enlace.trim()).protocol); } catch {}
    if (!valido) throw new Error('El enlace debe ser una dirección http o https válida.');
  }
  const respuesta = await apiPost(`/api/afiliados/cafeterias/${cafeteria}/campanas/${campana}/solicitudes`, {
    plan_promocion: plan.trim(), ...(enlace.trim() ? { enlace_publico: enlace.trim() } : {}),
  });
  return solicitud({ ...(respuesta as object), cafeteria_id: cafeteria, campana_id: campana });
}

// V04 / 0020 concede SELECT al usuario autenticado y limita sus filas con RLS.
// Se consulta el registro persistido, también cuando codigo_activo cambia a false.
export async function consultarMovimientosComision(afiliacionId: number): Promise<MovimientoComision[]> {
  const afiliacion = id(afiliacionId);
  const filas: MovimientoComision[] = [];
  const vistos = new Set<number>();
  let total: number | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const { data, count, error } = await leerConRenovacion(() => supabase.from('movimientos_comision')
      .select('id,afiliacion_id,pedido_id,tipo,estado,monto_clp,creado_en', { count: 'exact' })
      .eq('afiliacion_id', afiliacion).order('id', { ascending: true }).range(filas.length, filas.length + 199));
    if (error) throw new Error('No se pudieron consultar las comisiones. Intenta nuevamente.');
    if (!Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        (total !== undefined && count !== total) || filas.length + data.length > count ||
        (!data.length && filas.length < count)) throw new Error('No se pudo confirmar el historial completo de comisiones. Actualiza la consulta.');
    total = count;
    for (const fila of data) {
      const movimientoId = id(fila.id);
      if (id(fila.afiliacion_id) !== afiliacion || vistos.has(movimientoId) ||
          !['comision', 'reversion'].includes(fila.tipo) ||
          !['pendiente', 'disponible', 'revertida'].includes(fila.estado) ||
          !Number.isSafeInteger(fila.monto_clp) ||
          (fila.tipo === 'comision' ? fila.monto_clp < 0 : fila.monto_clp > 0 || fila.estado !== 'revertida') ||
          typeof fila.creado_en !== 'string' || !Number.isFinite(Date.parse(fila.creado_en))) throw new Error('La respuesta de comisiones no es válida.');
      vistos.add(movimientoId);
      filas.push({ ...fila, id: movimientoId, afiliacion_id: afiliacion, pedido_id: id(fila.pedido_id) });
    }
    if (filas.length === total) return filas;
  }
  throw new Error('El historial es demasiado extenso para cargarlo completo. No se muestra un saldo parcial.');
}
export function resumirComisiones(filas: MovimientoComision[]) {
  const resumen = { disponible: 0, pendiente: 0 };
  for (const fila of filas) {
    if (fila.tipo === 'comision' && fila.estado === 'disponible') resumen.disponible += fila.monto_clp;
    if (fila.tipo === 'comision' && fila.estado === 'pendiente') resumen.pendiente += fila.monto_clp;
  }
  if (!Number.isSafeInteger(resumen.disponible) || !Number.isSafeInteger(resumen.pendiente)) {
    throw new Error('El saldo excede el rango admitido.');
  }
  return resumen;
}
