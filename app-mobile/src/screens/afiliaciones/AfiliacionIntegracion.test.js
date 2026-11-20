// Opt-in. El runner C05 --a06 entrega únicamente credenciales locales efímeras.
import React from 'react';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';

jest.mock('../../lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js');
  const token = process.env.A06_STUDENT_TOKEN;
  const client = token ? createClient(process.env.A06_SUPABASE_URL, process.env.A06_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (...args) => global.fetch(...args) },
  }) : null;
  return { supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: token } }, error: null }) },
    from: (...args) => client.from(...args),
    rpc: (...args) => client.rpc(...args),
  } };
});
const integracion = process.env.A06_INTEGRATION_URL ? test : test.skip;
integracion('A06: solicitud y aprobación reales; desactivar conserva código reservado, saldo e historial', async () => {
  const fetchAnterior = global.fetch;
  let tree;
  global.fetch = (url, opciones = {}) => new Promise((resolve, reject) => {
    const headers = opciones.headers?.entries ? Object.fromEntries(opciones.headers.entries()) : opciones.headers;
    const request = http.request(String(url), { method: opciones.method, headers }, response => {
      let body = ''; response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        opciones.signal?.removeEventListener('abort', cancelar);
        resolve({ ok: response.statusCode < 400, status: response.statusCode, statusText: response.statusMessage,
          text: async () => body, json: async () => JSON.parse(body), headers: { get: key => response.headers[key.toLowerCase()] } });
      });
      response.on('error', reject);
    });
    const cancelar = () => request.destroy(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    opciones.signal?.addEventListener('abort', cancelar, { once: true });
    request.on('error', reject); request.end(opciones.body);
  });
  const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
  const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
  const pulsar = async label => act(async () => boton(label).props.onPress());
  const esperar = async comprobar => {
    for (let n = 0; n < 150; n++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
      if (comprobar() && tree.root.findAllByType(ActivityIndicator).length === 0) return;
    }
    throw new Error(`Estado A06 no observado. Vista: ${texto()}`);
  };
  const api = async (ruta, token, method = 'GET', body) => {
    let resultado;
    await act(async () => {
      const response = await global.fetch(process.env.A06_INTEGRATION_URL + ruta, { method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw new Error(`La operación de integración devolvió HTTP ${response.status}`);
      resultado = await response.json();
    });
    return resultado;
  };
  const montar = async () => act(async () => { tree = create(<MisAfiliacionesScreen nombreUsuario="Estudiante A06" onBack={() => {}} />); });
  try {
    await montar();
    await esperar(() => texto().includes('Solicitud rechazada'));
    expect(texto()).toContain('Solicitud pendiente');
    expect(texto()).not.toContain('Código:');
    expect(boton('Ganancias')).toBeUndefined(); expect(boton('Historial')).toBeUndefined();
    expect(boton('Mis códigos')).toBeUndefined();
    console.log('PASS A06: pendiente y rechazada sin código ni controles financieros');
    await pulsar('Oportunidades');
    await esperar(() => Boolean(boton('Ver campañas de Norte A06')));
    await pulsar('Ver campañas de Norte A06');
    await esperar(() => Boolean(boton('Solicitar afiliación a Para aprobar A06')));
    await pulsar('Solicitar afiliación a Para aprobar A06');
    act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Plan de promoción')
      .props.onChangeText('Compartiré un video desde Mobile A06'));
    await pulsar('Enviar solicitud de afiliación');
    await esperar(() => !boton('Solicitar afiliación a Para aprobar A06'));
    const perfil = await api('/api/afiliados/mi-perfil', process.env.A06_STUDENT_TOKEN);
    const solicitud = perfil.solicitudes.find(s => s.campana_id === Number(process.env.A06_CAMPAIGN_ID));
    expect(solicitud.estado).toBe('pendiente');
    const recurso = `/api/afiliados/cafeterias/7/campanas/${solicitud.campana_id}/solicitudes/${solicitud.id}`;
    const aprobada = await api(recurso, process.env.A06_OWNER_TOKEN, 'PATCH', { decision: 'aprobar' });
    await pulsar('Actualizar mis solicitudes');
    await esperar(() => texto().includes(aprobada.codigo));
    expect(boton('Ganancias')).toBeDefined(); expect(boton('Historial')).toBeDefined();
    console.log('PASS A06: POST móvil pendiente; aprobación del dueño muestra el código generado por SQL y habilita el panel');
    const db = process.env.A06_DB_CONTAINER;
    expect(db).toMatch(/^cf-c03-auth-\d+-\d+-db$/);
    expect(Number.isSafeInteger(solicitud.id)).toBe(true);
    execFileSync('docker', ['exec', '-i', db, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: `INSERT INTO public.pedidos(id,cafeteria_id,estado) VALUES (1001,7,'listo'),(1002,7,'entregado'),(1003,7,'entregado');
        INSERT INTO public.movimientos_comision(afiliacion_id,pedido_id,tipo,base_calculo_clp,tasa_comision,monto_clp)
        VALUES (${solicitud.id},1001,'comision',5000,10,500),
          (${solicitud.id},1002,'comision',6000,10,600),
          (${solicitud.id},1003,'comision',4000,10,400);
        UPDATE public.movimientos_comision SET estado='disponible' WHERE afiliacion_id=${solicitud.id} AND pedido_id IN (1002,1003);
        INSERT INTO public.retiros_afiliado(estudiante_id,monto_clp) VALUES (901,300);`,
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    await pulsar('Ganancias');
    await esperar(() => texto().includes('Saldo disponible para retirar: $700'));
    expect(texto()).toContain('Comisiones pendientes: $500');
    expect(texto()).toContain('Comisiones retiradas: $300');
    expect(texto()).not.toContain('Saldo disponible para retirar: $1.200');
    const montoRetiro = valor => act(() => tree.root.findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos').props.onChangeText(valor));
    montoRetiro('0');
    await pulsar('Revisar solicitud de retiro simulado');
    expect(texto()).toContain('mayor que $0');
    montoRetiro('701');
    await pulsar('Revisar solicitud de retiro simulado');
    expect(texto()).toContain('no puede superar tu saldo disponible de $700');
    montoRetiro('500');
    await pulsar('Revisar solicitud de retiro simulado');
    expect(texto()).toContain('Monto válido para revisar: $500');
    expect(texto()).toContain('Cuenta de prueba CoffeeFast (destino ficticio)');
    expect(texto()).toContain('todavía no se ha enviado');
    expect(texto()).toContain('Saldo disponible para retirar: $700');
    const retiros = execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-At', '-c',
      'SELECT count(*), sum(monto_clp) FROM public.retiros_afiliado WHERE estudiante_id=901'], { encoding: 'utf8' });
    expect(retiros.trim()).toBe('1|300');
    console.log('PASS A11: cero y superior rechazados, $500 válido con destino ficticio; saldo $700 y retiro histórico $300 sin cambios');
    const saldoPropio = await api('/rest/v1/rpc/consultar_saldo_afiliado', process.env.A06_STUDENT_TOKEN, 'POST', {});
    expect(saldoPropio).toEqual([{ pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 }]);
    const saldoAjeno = await api('/rest/v1/rpc/consultar_saldo_afiliado', process.env.A09_OTHER_STUDENT_TOKEN, 'POST', {});
    expect(saldoAjeno).toEqual([{ pendiente_clp: 0, disponible_clp: 0, retirado_clp: 0 }]);
    console.log('PASS A09 antes de entrega controlada: pendiente $500, disponible neto $700, retirado $300; otro estudiante en cero');
    // Fixture de transición: no se presenta como prueba del trigger V11 de entrega.
    execFileSync('docker', ['exec', '-i', db, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: `BEGIN; UPDATE public.pedidos SET estado='entregado' WHERE id=1001;
        UPDATE public.movimientos_comision SET estado='disponible' WHERE afiliacion_id=${solicitud.id} AND pedido_id=1001; COMMIT;`,
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    await pulsar('Actualizar saldo de comisiones');
    await esperar(() => texto().includes('Saldo disponible para retirar: $1.200'));
    expect(texto()).toContain('Comisiones pendientes: $0');
    expect(texto()).toContain('Comisiones retiradas: $300');
    console.log('PASS A09 después de entrega controlada: pendiente $0, disponible $1.200, retirado $300; RPC oficial V12');
    await api(recurso, process.env.A06_OWNER_TOKEN, 'PATCH', { decision: 'desactivar' });
    await pulsar('Actualizar mis solicitudes');
    await esperar(() => texto().includes('El código está desactivado'));
    expect(texto()).toContain('Saldo disponible para retirar: $1.200');
    await pulsar('Mis códigos');
    await esperar(() => texto().includes('Código desactivado: ya no se puede usar'));
    expect(texto()).toContain(aprobada.codigo);
    expect(texto()).toContain('Solicitud pendiente');
    expect(texto()).toContain('Solicitud rechazada');
    await pulsar('Historial');
    await esperar(() => texto().includes('Comisión · Pedido #1001'));
    expect(texto()).toContain('Comisión · Pedido #1002');
    expect(texto()).toContain('Comisión · Pedido #1003');
    expect(texto()).toContain('Saldo disponible para retirar: $1.200');
    console.log('PASS A06/A09: tres movimientos con límite de dos filas; código desactivado conserva saldo neto $1.200 e historial por RLS real');
    act(() => tree.unmount()); tree = null;
    await montar();
    await esperar(() => texto().includes('Código desactivado: ya no se puede usar'));
    await pulsar('Historial');
    await esperar(() => texto().includes('Comisión · Pedido #1001'));
    expect(texto()).toContain('Comisión · Pedido #1002');
    expect(texto()).toContain('Comisión · Pedido #1003');
    expect(texto()).toContain('Saldo disponible para retirar: $1.200');
    if (process.env.A06_FOREIGN_CODE) expect(texto()).not.toContain(process.env.A06_FOREIGN_CODE);
    console.log('PASS A06: reabrir consulta estado, saldo e historial persistidos sin recuperar código activo');
  } finally {
    if (tree) act(() => tree.unmount()); global.fetch = fetchAnterior;
  }
});
