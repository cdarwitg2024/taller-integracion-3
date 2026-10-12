import { supabase } from '../lib/supabase';

const API_URL_BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
};

async function request(path: string, options: RequestOptions = {}) {
  const { method = 'GET', headers = {}, body, timeoutMs = 4000 } = options;
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fullUrl = API_URL_BASE + (path.startsWith('/') ? path : '/' + path);
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet(path: string, options: RequestOptions = {}) {
  return request(path, { ...options, method: 'GET' });
}

export async function apiPost(path: string, body?: any, options: RequestOptions = {}) {
  return request(path, { ...options, method: 'POST', body });
}

export async function apiPatch(path: string, body?: any, options: RequestOptions = {}) {
  return request(path, { ...options, method: 'PATCH', body });
}

export const getBackendBaseUrl = () => API_URL_BASE;
