import React from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import Button from '../src/components/Button';
import { LoginScreen } from '../src/screens/LoginScreen';
import { supabase } from '../src/lib/supabase';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000014' }));
jest.mock('../src/screens/CafeteriaListScreen', () => ({ CafeteriaListScreen: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn(),
    startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
  from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(),
} }));

const cuentas = ['A', 'B'].map((letra, indice) => ({
  letra, id: 901 + indice, afiliacion: 82 + indice, pedido: 501 + indice,
  nombre: `Estudiante A14 ${letra}`, codigo: `CODIGO-A14-${letra}`,
  referencia: `00000000-0000-4000-8000-00000000000${indice + 1}`,
  pendiente: 111 * (indice + 1), disponible: 1111 * (indice + 1), retirado: 10 * (indice + 1),
  session: { access_token: `jwt-fixture-a14-${letra}`, user: {
    id: `00000000-0000-4000-8000-00000000001${indice}`, email: `a14-${letra.toLowerCase()}@example.test`,
  } },
}));
const [a, b] = cuentas;
const fecha = '2026-11-23T12:00:00Z';
const solicitud = c => ({ id: c.afiliacion, cafeteria_id: 7, campana_id: 31, estado: 'aprobada', codigo: c.codigo, codigo_activo: true });
const saldo = c => ({ pendiente_clp: c.pendiente, disponible_clp: c.disponible, retirado_clp: c.retirado });
const retiro = c => ({ id: c.id, monto_clp: c.retirado, creado_en: fecha, referencia: c.referencia });
const movimientos = c => [
  { id: c.id, afiliacion_id: c.afiliacion, pedido_id: c.pedido, tipo: 'comision', estado: 'disponible', monto_clp: c.disponible + c.retirado, creado_en: fecha },
  { id: c.id + 10, afiliacion_id: c.afiliacion, pedido_id: c.pedido + 10, tipo: 'comision', estado: 'pendiente', monto_clp: c.pendiente, creado_en: fecha },
];
let tree, actual, avisarAuth, retenidas, tardias, peticiones;
const fetchAnterior = global.fetch;
const urlAnterior = process.env.EXPO_PUBLIC_API_URL;
const clave = (c, fuente) => `${c.letra}:${fuente}`;
const responder = (c, fuente, respuesta) => {
  peticiones.push({ estudiante: c.letra, fuente });
  if (!retenidas.has(clave(c, fuente))) return Promise.resolve(respuesta);
  return new Promise(resolve => tardias.push({ estudiante: c.letra, fuente, terminar: () => resolve(respuesta) }));
};
const textos = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).filter(v => typeof v === 'string').join(' | ');
const boton = titulo => tree.root.findAllByType(Button).find(n => n.props.title === titulo);
const pulsar = async titulo => act(async () => boton(titulo).props.onPress());
const acceso = async etiqueta => act(async () => tree.root.findAllByType(TouchableOpacity)
  .find(n => n.props.accessibilityLabel === etiqueta).props.onPress());
const pestana = async nombre => {
  await act(async () => tree.root.findAllByType(TouchableOpacity)
    .find(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel.startsWith(nombre)).props.onPress());
  act(() => jest.advanceTimersByTime(200));
};
const cambiarAuth = (evento, c) => { actual = c; avisarAuth(evento, c?.session ?? null); };
const sinDatosDeA = () => {
  for (const dato of [a.codigo, a.referencia, a.nombre, 'Saldo disponible para retirar: $1.111',
    'Comisiones pendientes: $111', 'Comisión · Pedido #501', '$1.121 · disponible']) expect(textos()).not.toContain(dato);
};
const abrirAfiliaciones = async c => {
  await pestana('Perfil'); await acceso('Mis afiliaciones');
  expect(textos()).toContain(c.codigo);
};
const verHistorial = async c => {
  await acceso('Historial');
  expect(textos()).toContain(c.referencia);
  expect(textos()).toContain(`Comisión · Pedido #${c.pedido}`);
  expect(textos()).toContain(`Saldo disponible para retirar: $${c.disponible.toLocaleString('es-CL')}`);
};

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  jest.clearAllMocks(); await AsyncStorage.clear();
  actual = a; retenidas = new Set(); tardias = []; peticiones = [];
  process.env.EXPO_PUBLIC_API_URL = 'http://a14-fixture';
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  supabase.auth.getSession.mockImplementation(async () => ({ data: { session: actual?.session ?? null }, error: null }));
  supabase.auth.onAuthStateChange.mockImplementation(cb => {
    avisarAuth = cb; return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  supabase.auth.signOut.mockImplementation(async () => { cambiarAuth('SIGNED_OUT', null); return { error: null }; });
  supabase.auth.signInWithPassword.mockImplementation(async ({ email }) => {
    const c = cuentas.find(cuenta => cuenta.session.user.email === email);
    cambiarAuth('SIGNED_IN', c); return { data: { session: c.session }, error: null };
  });
  supabase.channel.mockImplementation(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() }));
  supabase.rpc.mockImplementation(nombre => {
    expect(nombre).toBe('consultar_saldo_afiliado');
    return responder(actual, 'saldo', { data: [saldo(actual)], error: null, status: 200 });
  });
  supabase.from.mockImplementation(tabla => {
    const c = actual;
    const filtros = {};
    const consulta = {
      select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(), eq: jest.fn((campo, valor) => { filtros[campo] = valor; return consulta; }),
      maybeSingle: () => tabla === 'usuarios'
        ? responder(c, 'identidad', { data: { id: c.id, auth_user_id: c.session.user.id, email: c.session.user.email,
          nombre: c.nombre, apellido: '', roles: { nombre: 'estudiante' }, rol_id: 1 }, error: null })
        : Promise.resolve({ data: null, error: null }),
      limit: async () => ({ data: [], error: null }),
      range: () => {
        const data = tabla === 'retiros_afiliado' ? [retiro(c)]
          : filtros.afiliacion_id === c.afiliacion ? movimientos(c) : [];
        return responder(c, tabla === 'retiros_afiliado' ? 'retiros' : 'comisiones', { status: 200, data, count: data.length, error: null });
      },
    };
    return consulta;
  });
  global.fetch = jest.fn((url, opciones) => {
    expect(String(url)).toBe('http://a14-fixture/api/afiliados/mi-perfil');
    const c = cuentas.find(cuenta => `Bearer ${cuenta.session.access_token}` === opciones.headers.Authorization);
    expect(c).toBeDefined();
    return responder(c, 'perfil', { ok: true, status: 200, text: async () => JSON.stringify({ solicitudes: [solicitud(c)] }) });
  });
  await act(async () => { tree = create(<App />); });
});
afterEach(() => {
  if (tree) act(() => tree.unmount()); tree = null;
  global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
  jest.restoreAllMocks(); jest.useRealTimers();
});

test.each(['cerrar sesión', 'reemplazar sesión'])('A14: %s borra códigos, ganancias e historial y descarta respuestas tardías de A', async modo => {
  await abrirAfiliaciones(a); await verHistorial(a);
  for (const fuente of ['perfil', 'saldo', 'retiros', 'comisiones']) retenidas.add(clave(a, fuente));
  await acceso('Actualizar mis solicitudes');
  await acceso('Actualizar saldo de comisiones');
  await acceso('Actualizar historial de retiros');
  await acceso(`Actualizar comisiones de afiliación ${a.afiliacion}`);
  expect(tardias.map(r => r.fuente).sort()).toEqual(['comisiones', 'perfil', 'retiros', 'saldo']);
  if (modo === 'cerrar sesión') {
    await pulsar('Volver a Mis afiliaciones'); await pulsar('Volver al perfil'); await pulsar('Cerrar sesión');
    await act(async () => Alert.alert.mock.calls.at(-1)[2].find(opcion => opcion.text === 'Cerrar sesión').onPress());
    await act(async () => Alert.alert.mock.calls.at(-1)[2].find(opcion => opcion.text === 'Salir').onPress());
    expect(tree.root.findAllByType(LoginScreen)).toHaveLength(1); sinDatosDeA();
    await act(async () => {
      tree.root.findAllByType(TextInput).find(n => n.props.placeholder === 'tunombre@alu.uct.cl').props.onChangeText(b.session.user.email);
      tree.root.findAllByType(TextInput).find(n => n.props.placeholder === '••••••••').props.onChangeText('solo-fixture-a14');
    });
    await pulsar('Iniciar sesión');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  } else {
    await act(async () => cambiarAuth('SIGNED_IN', b));
  }
  sinDatosDeA();
  await abrirAfiliaciones(b); await verHistorial(b); sinDatosDeA();
  for (const fuente of ['retiros', 'comisiones', 'saldo', 'perfil']) {
    for (const respuesta of tardias.filter(r => r.fuente === fuente)) {
      await act(async () => respuesta.terminar());
      expect(textos()).toContain(b.referencia); expect(textos()).toContain(b.nombre); sinDatosDeA();
    }
  }
  for (const fuente of ['perfil', 'saldo', 'retiros', 'comisiones']) {
    expect(peticiones).toContainEqual({ estudiante: 'B', fuente });
  }
});

test('A14: la respuesta atrasada del perfil A no reemplaza a B ni muestra A durante la carga de B', async () => {
  await pestana('Perfil'); expect(textos()).toContain(a.nombre);
  retenidas.add(clave(a, 'identidad'));
  await act(async () => tree.root.findAllByType(ScrollView).find(n => n.props.refreshControl)
    .props.refreshControl.props.onRefresh());
  retenidas.add(clave(b, 'identidad'));
  await act(async () => cambiarAuth('SIGNED_IN', b));
  sinDatosDeA();
  expect(textos()).toContain('Cargando datos del estudiante');
  await act(async () => tardias.find(r => r.estudiante === 'B').terminar());
  await acceso('Mis afiliaciones'); await verHistorial(b);
  await act(async () => tardias.find(r => r.estudiante === 'A').terminar());
  expect(textos()).toContain(b.referencia); expect(textos()).toContain(b.nombre); sinDatosDeA();
});

test('A14: renovar el token de la misma cuenta conserva la sección y sus datos propios', async () => {
  await abrirAfiliaciones(a); await verHistorial(a);
  await act(async () => avisarAuth('TOKEN_REFRESHED', { ...a.session, user: { ...a.session.user } }));
  expect(textos()).toContain('Historial de ganancias y retiros'); expect(textos()).toContain(a.referencia);
  expect(textos()).not.toContain(b.codigo); expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
