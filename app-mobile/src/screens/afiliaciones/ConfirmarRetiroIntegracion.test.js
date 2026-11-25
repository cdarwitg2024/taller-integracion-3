// Opt-in: solo el runner desechable --a06 proporciona estas variables.
import React from 'react';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { ActivityIndicator, AppState, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';
import ComisionesAfiliado from './ComisionesAfiliado';

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
integracion('A12/A13/A05: entrega, retiro seguro y comprobante coherentes en la misma cuenta', async () => {
  const fetchAnterior = global.fetch;
  const listener = jest.spyOn(AppState, 'addEventListener');
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

    // A05: transición de entrega CONTROLADA en el fixture; no acredita KDS/V11.
    const sql = consulta => execFileSync('docker', ['exec', process.env.A12_DB_CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', consulta], { encoding: 'utf8' }).trim();
    const afiliacionA05 = Number(sql("SELECT afiliacion_id FROM public.movimientos_comision WHERE pedido_id=1005 AND tipo='comision'"));
    sql(`INSERT INTO public.pedidos(id,cafeteria_id,estado) VALUES (1006,7,'listo');
      INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
      VALUES (${afiliacionA05},1006,'comision',5000,10,500);`);
    await pulsar('Actualizar saldo de comisiones');
    await esperar(() => texto().includes('Comisiones pendientes: $500'));
    const textoComision = () => tree.root.findAllByType(ComisionesAfiliado).find(n => n.props.afiliacion.id === afiliacionA05)
      .findAllByType(Text).flatMap(n => n.props.children).join(' ');
    expect(textoComision()).toContain('$500 · pendiente');
    expect(texto()).toContain('Saldo disponible para retirar: $100');
    sql(`BEGIN; UPDATE public.pedidos SET estado='entregado' WHERE id=1006;
      UPDATE public.movimientos_comision SET estado='disponible' WHERE pedido_id=1006; COMMIT;`);
    const alVolver = listener.mock.calls.filter(([evento]) => evento === 'change').at(-1)[1];
    await act(async () => alVolver('active'));
    await esperar(() => texto().includes('Saldo disponible para retirar: $600') && textoComision().includes('$500 · disponible'));
    expect(textoComision()).not.toContain('$500 · pendiente');
    expect(texto()).toContain('Comisiones pendientes: $0');
    await pulsar('Preparar otro retiro simulado');
    act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos').props.onChangeText('500'));
    await pulsar('Revisar solicitud de retiro simulado'); perder = true;
    await pulsar('Confirmar retiro simulado');
    await esperar(() => Boolean(boton('Recuperar retiro simulado')));
    const referenciaA05 = original.referencia;
    await pulsar('Recuperar retiro simulado');
    await esperar(() => texto().includes(`Comprobante: ${referenciaA05}`) && texto().includes('Saldo disponible para retirar: $100'));
    expect(envios).toHaveLength(4); expect(envios[3]).toEqual(envios[2]);
    expect(envios[2].clave_idempotencia).not.toBe(envios[0].clave_idempotencia);
    expect(texto()).not.toContain('No pudimos confirmar el retiro');
    expect(texto()).toContain('Comisiones retiradas: $2.500');
    const filaA05 = JSON.parse(sql(`SELECT json_build_object('filas',count(*),'monto_clp',sum(monto_clp)) FROM public.retiros_afiliado
      WHERE estudiante_id=901 AND clave_idempotencia='${envios[2].clave_idempotencia}'`));
    expect(filaA05).toEqual({ filas: 1, monto_clp: 500 });
    act(() => tree.unmount()); tree = null;
    await act(async () => { tree = create(<MisAfiliacionesScreen usuarioId={process.env.A12_STUDENT_ID} onBack={() => {}} />); });
    await esperar(() => Boolean(boton('Historial'))); await pulsar('Historial');
    await esperar(() => texto().includes(`Comprobante: ${referenciaA05}`) && texto().includes('Saldo disponible para retirar: $100'));
    expect(texto()).toContain(`Referencia del comprobante: ${referenciaA05}`);
    expect(envios).toHaveLength(4);
    console.log('PASS A05:', JSON.stringify({ estudiante_id: 901, antes_entrega: { pendiente_clp: 500, disponible_clp: 100 },
      despues_entrega: { pendiente_clp: 0, disponible_clp: 600 }, retiro: { referencia: referenciaA05, ...filaA05 },
      disponible_final_clp: 100, retirado_total_clp: 2500, reabrir: 'misma referencia sin otro POST' }));
  } finally {
    if (tree) act(() => tree.unmount()); global.fetch = fetchAnterior; listener.mockRestore();
  }
});
