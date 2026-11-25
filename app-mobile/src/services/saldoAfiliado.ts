import { supabase } from '../lib/supabase';
import { leerConRenovacion } from '../lib/sesion';

export type SaldoAfiliado = { pendiente_clp: number; disponible_clp: number; retirado_clp: number };

// V12 obtiene la identidad del JWT y agrega todas las afiliaciones en una instantánea.
export async function consultarSaldoAfiliado(): Promise<SaldoAfiliado> {
  const { data, error, status: estadoHttp } = await leerConRenovacion(() => supabase.rpc('consultar_saldo_afiliado'));
  if (error || estadoHttp >= 400) {
    const status = estadoHttp === 401 || estadoHttp === 403 ? estadoHttp
      : error?.code === '42501' ? 403
        : ['PGRST301', 'PGRST303', '28000'].includes(error?.code) ? 401 : 503;
    throw Object.assign(new Error(status === 403 ? 'Tu cuenta no tiene permisos para consultar el saldo.'
      : status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión.'
        : 'No pudimos consultar el saldo. Intenta nuevamente.'), { status });
  }
  const fila = Array.isArray(data) && data.length === 1 ? data[0] : null;
  if (!fila || ![fila.pendiente_clp, fila.disponible_clp, fila.retirado_clp].every(Number.isSafeInteger) ||
      fila.pendiente_clp < 0 || fila.retirado_clp < 0) {
    throw new Error('No se pudo confirmar el saldo completo. Intenta nuevamente.');
  }
  return { pendiente_clp: fila.pendiente_clp, disponible_clp: fila.disponible_clp, retirado_clp: fila.retirado_clp };
}
