// Solo el runner desechable --a06 proporciona estas sesiones y el contenedor.
import React from 'react';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { ActivityIndicator, Share, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';

jest.mock('../../lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js');
  const token = process.env.A15_STUDENT_TOKEN;
  const client = token ? createClient(process.env.A15_SUPABASE_URL, process.env.A15_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (...args) => global.fetch(...args) },
  }) : null;
  return { supabase: {
    auth: { getSession: async () => ({ data: { session: {
      access_token: token, user: { id: process.env.A15_STUDENT_ID },
    } }, error: null }) },
    from: (...args) => client.from(...args), rpc: (...args) => client.rpc(...args),
  } };
});
const integracion = process.env.A15_INTEGRATION_URL ? test : test.skip;
integracion('A15: solicitud, aprobación, compartir, ganancia, retiro y desactivación con la misma cuenta', async () => {
  const fetchAnterior = global.fetch;
  const compartir = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  Clipboard.setStringAsync.mockClear();
  let tree;
  const enviosRetiro = [];
  const cam = Number(process.env.A15_CAMPAIGN_ID), db = process.env.A15_DB_CONTAINER;
  expect(Number.isSafeInteger(cam)).toBe(true); expect(db).toMatch(/^cf-c03-auth-\d+-\d+-db$/);
  const sql = consulta => execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', consulta],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  global.fetch = (url, opciones = {}) => new Promise((resolve, reject) => {
    if (opciones.method === 'POST' && String(url).endsWith('/api/afiliados/retiros')) enviosRetiro.push(JSON.parse(opciones.body));
    const headers = opciones.headers?.entries ? Object.fromEntries(opciones.headers.entries()) : opciones.headers;
    const request = http.request(String(url), { method: opciones.method, headers }, response => {
      let body = ''; response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        opciones.signal?.removeEventListener('abort', cancelar);
        resolve({ ok: response.statusCode < 400, status: response.statusCode, statusText: response.statusMessage,
          text: async () => body, json: async () => JSON.parse(body), headers: new Headers(response.headers) });
      });
    });
    const cancelar = () => request.destroy(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    opciones.signal?.addEventListener('abort', cancelar, { once: true });
    request.on('error', error => { opciones.signal?.removeEventListener('abort', cancelar); reject(error); });
    request.end(opciones.body);
  });
  const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
  const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
  const campo = label => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === label);
  const pulsar = async label => act(async () => { await boton(label).props.onPress(); });
  const esperar = async condicion => {
    for (let n = 0; n < 150; n++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
      if (condicion() && !tree.root.findAllByType(ActivityIndicator).length) return;
    }
    throw new Error(`Estado A15 no observado: ${texto()}`);
  };
  const api = async (ruta, token = process.env.A15_STUDENT_TOKEN, method = 'GET', body) => {
    let resultado;
    await act(async () => {
      const respuesta = await global.fetch(process.env.A15_INTEGRATION_URL + ruta, { method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body) });
      if (!respuesta.ok) throw new Error(`A15 HTTP ${respuesta.status}`);
      resultado = await respuesta.json();
    });
    return resultado;
  };
  const montar = async () => act(async () => { tree = create(<MisAfiliacionesScreen usuarioId={process.env.A15_STUDENT_ID}
    nombreUsuario="Estudiante ficticio A15" onBack={() => {}} />); });
  try {
    await montar(); await esperar(() => texto().includes('Todavía no tienes solicitudes'));
    expect(boton('Ganancias')).toBeUndefined(); expect(boton('Historial')).toBeUndefined();
    await pulsar('Oportunidades'); await esperar(() => Boolean(boton('Ver campañas de Norte A06')));
    await pulsar('Ver campañas de Norte A06'); await esperar(() => Boolean(boton('Solicitar afiliación a Piloto A15')));
    await pulsar('Solicitar afiliación a Piloto A15');
    act(() => campo('Plan de promoción').props.onChangeText('Compartiré el código de la campaña ficticia A15'));
    await pulsar('Enviar solicitud de afiliación'); await esperar(() => texto().includes('Solicitud pendiente'));
    expect(texto()).not.toContain('Código:'); expect(boton('Mis códigos')).toBeUndefined();
    expect(boton('Ganancias')).toBeUndefined(); expect(boton('Historial')).toBeUndefined();
    expect(compartir).not.toHaveBeenCalled(); expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    const perfil = await api('/api/afiliados/mi-perfil');
    const solicitud = perfil.solicitudes.find(s => s.campana_id === cam);
    expect(solicitud.estado).toBe('pendiente'); expect(solicitud.codigo).toBeUndefined();
    console.log('PASS A15 pendiente:', JSON.stringify({ estudiante_id: 902, solicitud_id: solicitud.id, codigo_visible: false, panel_habilitado: false }));

    const recurso = `/api/afiliados/cafeterias/7/campanas/${cam}/solicitudes`;
    const listadoDueno = await api(recurso, process.env.A15_OWNER_TOKEN);
    expect(listadoDueno.solicitudes.some(s => s.id === solicitud.id)).toBe(true);
    const aprobada = await api(`${recurso}/${solicitud.id}`, process.env.A15_OWNER_TOKEN, 'PATCH', { decision: 'aprobar' });
    expect(aprobada.estado).toBe('aprobada'); expect(aprobada.codigo_activo).toBe(true);
    await pulsar('Actualizar mis solicitudes'); await esperar(() => Boolean(boton('Mis códigos')));
    await pulsar('Mis códigos'); await esperar(() => texto().includes(`Código: ${aprobada.codigo}`));
    await pulsar(`Copiar código de campaña #${cam}, cafetería #7`);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(aprobada.codigo);
    expect(texto()).toContain(`Código copiado: ${aprobada.codigo}`);
    await pulsar(`Compartir código de campaña #${cam}, cafetería #7`);
    expect(compartir.mock.calls[0][0].message).toContain(aprobada.codigo);
    expect(compartir.mock.calls[0][0].message).toContain(`Campaña #${cam} · Cafetería #7`);
    console.log('PASS A15 aprobada:', JSON.stringify({ solicitud_id: solicitud.id, codigo: aprobada.codigo, copiar: 'código exacto', compartir: 'código y campaña exactos' }));

    // Ganancias ficticias persistidas, sin simular una compra o entrega real.
    sql(`INSERT INTO public.pedidos(id,cafeteria_id,estado) VALUES (2015,7,'entregado'),(2016,7,'listo');
      INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
      VALUES (${solicitud.id},2015,'comision',12000,10,1200),(${solicitud.id},2016,'comision',3000,10,300);
      UPDATE public.movimientos_comision SET estado='disponible' WHERE pedido_id=2015;`);
    await pulsar('Ganancias'); await esperar(() => texto().includes('Saldo disponible para retirar: $1.200'));
    expect(texto()).toContain('Comisiones pendientes: $300'); expect(texto()).toContain('Comisiones retiradas: $0');
    act(() => campo('Monto del retiro simulado en pesos chilenos').props.onChangeText('500'));
    await pulsar('Revisar solicitud de retiro simulado'); await pulsar('Confirmar retiro simulado');
    await esperar(() => texto().includes('Retiro simulado confirmado') && texto().includes('Saldo disponible para retirar: $700'));
    expect(enviosRetiro).toHaveLength(1); expect(texto()).toContain('Comisiones retiradas: $500');
    const retiro = JSON.parse(sql('SELECT row_to_json(r) FROM public.retiros_afiliado r WHERE estudiante_id=902'));
    expect(retiro.monto_clp).toBe(500); expect(texto()).toContain(`Referencia del comprobante: ${retiro.referencia}`);
    await pulsar('Ver retiro en historial'); await esperar(() => texto().includes(`Comprobante: ${retiro.referencia}`));
    expect(texto()).toContain('-$500 · confirmado'); expect(texto()).toContain('$1.200 · disponible');
    const saldoAntes = await api('/api/afiliados/saldo');
    expect(saldoAntes).toEqual({ pendiente_clp: 300, disponible_clp: 700, retirado_clp: 500 });
    console.log('PASS A15 retiro:', JSON.stringify({ disponible_antes_clp: 1200, ...saldoAntes, referencia: retiro.referencia, monto_clp: retiro.monto_clp, filas: 1 }));

    await pulsar('Mis códigos');
    const desactivada = await api(`${recurso}/${solicitud.id}`, process.env.A15_OWNER_TOKEN, 'PATCH', { decision: 'desactivar' });
    expect(desactivada.codigo_activo).toBe(false); expect(desactivada.codigo).toBe(aprobada.codigo);
    await pulsar('Actualizar mis solicitudes'); await esperar(() => texto().includes('Código desactivado'));
    expect(boton(`Copiar código de campaña #${cam}, cafetería #7`)).toBeUndefined();
    expect(boton(`Compartir código de campaña #${cam}, cafetería #7`)).toBeUndefined();
    expect(await api('/api/afiliados/saldo')).toEqual(saldoAntes);
    let rechazo;
    try {
      sql(`BEGIN; INSERT INTO public.pedidos(id,cafeteria_id,estado) VALUES (2017,7,'entregado');
        INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
        VALUES (${solicitud.id},2017,'comision',1000,10,100); COMMIT;`);
    } catch (error) { rechazo = String(error.stderr); }
    expect(rechazo).toContain('La atribución requiere una afiliación aprobada con código activo');
    expect(sql('SELECT count(*) FROM public.pedidos WHERE id=2017')).toBe('0');
    await pulsar('Historial'); await esperar(() => texto().includes(`Comprobante: ${retiro.referencia}`));
    expect(texto()).toContain('Saldo disponible para retirar: $700'); expect(texto()).toContain('$1.200 · disponible');
    expect(texto()).toContain('$300 · pendiente'); expect(texto()).toContain('-$500 · confirmado');
    act(() => tree.unmount()); tree = null; await montar(); await esperar(() => Boolean(boton('Historial')));
    expect(texto()).toContain('Código desactivado'); await pulsar('Historial');
    await esperar(() => texto().includes(`Comprobante: ${retiro.referencia}`) && texto().includes('Saldo disponible para retirar: $700'));
    expect(enviosRetiro).toHaveLength(1); expect(sql('SELECT count(*) FROM public.retiros_afiliado WHERE estudiante_id=902')).toBe('1');
    console.log('PASS A15 desactivada:', JSON.stringify({ solicitud_id: solicitud.id, codigo_activo: false,
      saldo_conservado: saldoAntes, referencia: retiro.referencia, atribucion_nueva: 'rechazada por SQL', reabrir: 'sin otro retiro' }));
  } finally {
    if (tree) act(() => tree.unmount()); global.fetch = fetchAnterior; compartir.mockRestore();
  }
});
