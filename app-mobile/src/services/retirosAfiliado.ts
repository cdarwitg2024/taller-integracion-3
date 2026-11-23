import { supabase } from '../lib/supabase';
import { leerConRenovacion } from '../lib/sesion';

export type RetiroAfiliado = {
  id: number; monto_clp: number; creado_en: string; referencia: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// V12 concede únicamente SELECT propio mediante RLS; V14 añade referencia.
// No se llama a registrar_retiro_simulado: abrir el historial nunca debita saldo.
export async function consultarRetirosAfiliado(): Promise<RetiroAfiliado[]> {
  const filas: RetiroAfiliado[] = [];
  let total: number | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const { data, count, error, status: estadoHttp } = await leerConRenovacion(() => supabase.from('retiros_afiliado')
      .select('id,monto_clp,creado_en,referencia', { count: 'exact' })
      .order('id', { ascending: true }).range(filas.length, filas.length + 199));
    if (error || estadoHttp >= 400) {
      const status = estadoHttp === 401 || estadoHttp === 403 ? estadoHttp
        : error?.code === '42501' ? 403
          : ['PGRST301', 'PGRST303', '28000'].includes(error?.code) ? 401 : 503;
      throw Object.assign(new Error(status === 403 ? 'Tu cuenta no tiene permisos para consultar retiros.'
        : status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión.'
          : 'No pudimos consultar los retiros. Intenta nuevamente.'), { status });
    }
    if (!Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        (total !== undefined && count !== total) || filas.length + data.length > count ||
        (!data.length && filas.length < count)) {
      throw new Error('No se pudo confirmar el historial completo de retiros. Intenta nuevamente.');
    }
    total = count;
    for (const fila of data) {
      if (!fila || !Number.isSafeInteger(fila.id) || fila.id <= (filas[filas.length - 1]?.id ?? 0) ||
          !Number.isSafeInteger(fila.monto_clp) || fila.monto_clp <= 0 ||
          typeof fila.creado_en !== 'string' || !Number.isFinite(Date.parse(fila.creado_en)) ||
          (fila.referencia !== null && (typeof fila.referencia !== 'string' || !uuid.test(fila.referencia)))) {
        throw new Error('La respuesta de retiros no es válida. Intenta nuevamente.');
      }
      filas.push({ id: fila.id, monto_clp: fila.monto_clp, creado_en: fila.creado_en, referencia: fila.referencia });
    }
    if (filas.length === total) return filas;
  }
  throw new Error('El historial de retiros es demasiado extenso para cargarlo completo.');
}
