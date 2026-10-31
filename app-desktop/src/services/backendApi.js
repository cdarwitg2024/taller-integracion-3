export const BASE_BACKEND =
  import.meta.env?.VITE_BACKEND || 'http://localhost:3000';

export const CAFETERIA_ID =
  import.meta.env?.VITE_CAFETERIA_ID ? Number(import.meta.env.VITE_CAFETERIA_ID) : null;

import { supabase } from './supabase';

async function getAccessToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function request(url, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No hay sesión activa. Inicie sesión nuevamente.');
  }
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(url, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) {
      const msg = body?.message || body?.error || 'No autorizado. Sesión inválida o vencida.';
      const err = new Error(msg);
      err.status = res.status;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

/** PATCH /api/pedidos/:id/estado en backend-node */
export async function cambiarEstadoPedido(pedidoId, estado) {
  const enviado = estado === 'en_preparacion' ? 'preparando' : estado;
  const body = await request(`${BASE_BACKEND}/api/pedidos/${pedidoId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: enviado }),
  });
  return body?.pedido || body;
}

/** POST /api/pedidos/validar-qr en backend-node (escaneo de entrega desde el KDS) */
export async function validarQr(token) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('No hay sesión activa. Inicie sesión nuevamente.');
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
  const res = await fetch(`${BASE_BACKEND}/api/pedidos/validar-qr`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: String(token) }),
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    throw new Error(body?.error || body?.message || 'No autorizado. Sesión inválida o vencida.');
  }
  if (body && typeof body.valido !== 'undefined') return body;
  if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  return body;
}

export const backendApi = {
  cambiarEstadoPedido,
  validarQr,
};
export default backendApi;