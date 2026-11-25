// Opt-in: solo el runner desechable --a06 proporciona estas variables.
import React from 'react';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';

jest.mock('../../lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js');
  const token = process.env.A12_STUDENT_TOKEN;
  const client = token ? createClient(process.env.A12_SUPABASE_URL, process.env.A12_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (...args) => global.fetch(...args) },
  }) : null;
  return { supabase: {
    auth: { getSession: async () => ({ data: { session: {
      access_token: token, user: { id: process.env.A12_STUDENT_ID },
    } }, error: null }) },
    rpc: (...args) => client.rpc(...args),
    from: (...args) => client.from(...args),
  } };
});
const integracion = process.env.A12_INTEGRATION_URL ? test : test.skip;
integracion('A12/A13: mismo comprobante en Supabase, saldo actualizado e historial al reabrir', async () => {
  const fetchAnterior = global.fetch;
  let tree, perder = true, original;
  const envios = [];
  // Transporte HTTP real; solo se descarta la primera respuesta DESPUÉS del commit.
  global.fetch = (url, opciones = {}) => new Promise((resolve, reject) => {
    const esRetiro = opciones.method === 'POST' && String(url).endsWith('/api/afiliados/retiros');
    if (esRetiro) envios.push(JSON.parse(opciones.body));
    const headers = opciones.headers?.entries ? Object.fromEntries(opciones.headers.entries()) : opciones.headers;
    const request = http.request(String(url), { method: opciones.method, headers }, response => {
      let body = ''; response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        opciones.signal?.removeEventListener('abort', abortar);
        if (esRetiro && perder) {
          perder = false; original = JSON.parse(body);
          if (response.statusCode !== 200) return reject(new Error(`Primer retiro HTTP ${response.statusCode}`));
          return reject(new Error('Pérdida de respuesta tras persistir el retiro'));
        }
        resolve({ ok: response.statusCode < 400, status: response.statusCode, statusText: response.statusMessage,
          headers: new Headers(response.headers), text: async () => body, json: async () => JSON.parse(body) });
      });
    });
    const abortar = () => request.destroy(Object.assign(new Error('Tiempo agotado'), { name: 'AbortError' }));
    opciones.signal?.addEventListener('abort', abortar);
    request.on('error', error => { opciones.signal?.removeEventListener('abort', abortar); reject(error); });
    request.end(opciones.body);
  });
  const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
  const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
  const pulsar = async label => act(async () => { await boton(label).props.onPress(); });
  const esperar = async condicion => {
    for (let n = 0; n < 150; n++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
      if (condicion() && !tree.root.findAllByType(ActivityIndicator).length) return;
    }
    throw new Error(`Estado A12 no observado: ${texto()}`);
  };
  try {
    await act(async () => { tree = create(<MisAfiliacionesScreen usuarioId={process.env.A12_STUDENT_ID} onBack={() => {}} />); });
    await esperar(() => Boolean(boton('Ganancias')));
    await pulsar('Ganancias');
    await esperar(() => texto().includes('Saldo disponible para retirar: $600'));
    act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos').props.onChangeText('500'));
    await pulsar('Revisar solicitud de retiro simulado');
    await pulsar('Confirmar retiro simulado');
    await esperar(() => Boolean(boton('Recuperar retiro simulado')));
    expect(original).toMatchObject({ monto_clp: 500, estado: 'confirmado', disponible_clp: 100 });
    await pulsar('Recuperar retiro simulado');
    await esperar(() => texto().includes('Retiro simulado confirmado') && texto().includes('Saldo disponible para retirar: $100'));
    expect(envios).toHaveLength(2); expect(envios[1]).toEqual(envios[0]);
    expect(texto()).toContain(original.referencia);
    const resultado = execFileSync('docker', ['exec', process.env.A12_DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-c',
      `SELECT count(*),sum(monto_clp) FROM public.retiros_afiliado WHERE estudiante_id=901 AND clave_idempotencia='${envios[0].clave_idempotencia}'`], { encoding: 'utf8' });
    expect(resultado.trim()).toBe('1|500');
    const persistido = JSON.parse(execFileSync('docker', ['exec', process.env.A12_DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-c',
      `SELECT json_build_object('referencia',referencia,'monto_clp',monto_clp) FROM public.retiros_afiliado WHERE estudiante_id=901 AND clave_idempotencia='${envios[0].clave_idempotencia}'`], { encoding: 'utf8' }));
    expect(persistido).toEqual({ referencia: original.referencia, monto_clp: original.monto_clp });
    await pulsar('Ver retiro en historial');
    await esperar(() => texto().includes(`Comprobante: ${original.referencia}`));
    expect(texto()).toContain('-$500 · confirmado');
    const campoBusqueda = () => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Buscar retiro por referencia de comprobante');
    expect(campoBusqueda().props.value).toBe(original.referencia);
    act(() => tree.unmount()); tree = null;
    await act(async () => { tree = create(<MisAfiliacionesScreen usuarioId={process.env.A12_STUDENT_ID} onBack={() => {}} />); });
    await esperar(() => Boolean(boton('Historial')));
    await pulsar('Historial');
    await esperar(() => texto().includes(`Comprobante: ${original.referencia}`) && texto().includes('Saldo disponible para retirar: $100'));
    expect(texto()).toContain('-$500 · confirmado'); expect(envios).toHaveLength(2);
    console.log('PASS A13:', JSON.stringify({ persistido, historial: 'mismo importe/referencia al reabrir', disponible_final_clp: 100, retiros_creados: 1 }));
    console.log('PASS A12:', JSON.stringify({ solicitudes: envios, comprobante: original, filas: 1, disponible_final_clp: 100 }));
  } finally {
    if (tree) act(() => tree.unmount()); global.fetch = fetchAnterior;
  }
});
