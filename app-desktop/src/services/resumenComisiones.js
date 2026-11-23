// Resumen de ventas referidas y comisiones del dueño, leído con RLS desde Supabase.
import { supabase as supabaseOriginal } from './supabaseClient';

// Devuelve el resumen vacío usado cuando no hay movimientos o no hay cafetería.
export function resumenVacio() {
  return {
    ventasReferidas: 0,
    totalCobrado: 0,
    comisiones: { pendiente: 0, disponible: 0, revertida: 0 },
    reversiones: 0,
    movimientos: [],
  };
}

// Agrupa los movimientos de una cafetería sin contar dos veces la reversión.
export function construirResumen(filas = [], cafeteriaId = null) {
  const resumen = resumenVacio();
  if (cafeteriaId === null || cafeteriaId === undefined || String(cafeteriaId).trim() === '') {
    return resumen;
  }

  const cafeteria = String(cafeteriaId);
  const pedidosVistos = new Set();
  for (const fila of filas) {
    const pedido = fila.pedidos;
    if (!pedido || String(pedido.cafeteria_id) !== cafeteria) continue;
    const monto = Number(fila.monto_clp);
    if (!Number.isFinite(monto)) continue;

    resumen.movimientos.push({
      id: fila.id,
      pedidoId: fila.pedido_id,
      tipo: fila.tipo,
      estado: fila.estado,
      montoClp: monto,
      creadoEn: fila.creado_en,
    });

    if (fila.tipo === 'reversion') {
      resumen.reversiones += monto;
      continue;
    }
    if (fila.tipo !== 'comision' || !Object.hasOwn(resumen.comisiones, fila.estado)) continue;

    resumen.comisiones[fila.estado] += monto;
    if (pedidosVistos.has(fila.pedido_id)) continue;
    pedidosVistos.add(fila.pedido_id);
    resumen.ventasReferidas += 1;
    const total = Number(pedido.total);
    if (Number.isFinite(total)) resumen.totalCobrado += total;
  }

  resumen.movimientos.sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
  return resumen;
}

// Consulta los movimientos de comisión visibles para el dueño y los resume por cafetería.
export async function obtenerResumenComisiones(cafeteriaId, supabase = supabaseOriginal) {
  if (cafeteriaId === null || cafeteriaId === undefined || String(cafeteriaId).trim() === '') {
    return resumenVacio();
  }

  const { data, error } = await supabase
    .from('movimientos_comision')
    .select('id, pedido_id, tipo, estado, monto_clp, creado_en, pedidos!inner(cafeteria_id, total)')
    .order('creado_en', { ascending: false });

  if (error) throw new Error(error.message || 'No se pudieron consultar las comisiones.');
  return construirResumen(data || [], cafeteriaId);
}

export const resumenComisiones = {
  obtener: obtenerResumenComisiones,
};

export default resumenComisiones;
