import { supabase } from './supabase';

export const esJwtVencido = error => error?.code === 'PGRST303' && /jwt expired/i.test(error?.message || '');
let renovacion = null;

// Solo para lecturas: reintentar escrituras podría duplicar un pago.
export async function leerConRenovacion(consultar) {
  const respuesta = await consultar();
  if (!esJwtVencido(respuesta.error)) return respuesta;
  if (!renovacion) {
    renovacion = supabase.auth.refreshSession().then(({ data, error }) => {
      if (error) throw error;
      if (!data?.session?.access_token) throw new Error('No se pudo renovar la sesión. Inicia sesión nuevamente.');
    }).finally(() => { renovacion = null; });
  }
  await renovacion;
  return consultar(); // Un único reintento; nunca un bucle de renovación.
}

export function vincularRenovacion(auth, appState) {
  const actualizar = state => {
    const operacion = state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh();
    Promise.resolve(operacion).catch(error => console.warn('No se pudo actualizar la renovación de sesión:', error.message));
  };
  actualizar(appState.currentState);
  const listener = appState.addEventListener('change', actualizar);
  return () => {
    listener.remove();
    Promise.resolve(auth.stopAutoRefresh()).catch(error => console.warn('No se pudo detener la renovación:', error.message));
  };
}
