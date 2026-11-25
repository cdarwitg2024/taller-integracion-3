import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';
import { supabase } from '../../lib/supabase';
import { consultarAfiliaciones, consultarMovimientosComision } from '../../services/afiliaciones';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
import { consultarRetirosAfiliado } from '../../services/retirosAfiliado';
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../../services/afiliaciones', () => ({
  consultarAfiliaciones: jest.fn(), consultarMovimientosComision: jest.fn(),
  resumirComisiones: jest.requireActual('../../services/afiliaciones').resumirComisiones,
}));
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));
jest.mock('../../services/retirosAfiliado', () => ({ consultarRetirosAfiliado: jest.fn() }));
const referencia = '00000000-0000-4000-8000-000000000055';
let tree, fetchAnterior, urlAnterior, disponible, entregado, filas, perdidas, solicitudes;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const pulsar = async label => act(async () => { await boton(label).props.onPress(); });
const montar = async () => act(async () => { tree = create(<MisAfiliacionesScreen usuarioId="estudiante-a05" onBack={() => {}} />); });
const entregar = () => { entregado = true; disponible += 500; };
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks();
  disponible = 700; entregado = false; filas = []; perdidas = true; solicitudes = [];
  consultarAfiliaciones.mockImplementation(async () => [{ id: 82, cafeteria_id: 7, campana_id: 31,
    estado: 'aprobada', codigo: 'CODIGO-PRUEBA', codigo_activo: true }]);
  consultarMovimientosComision.mockImplementation(async () => [{ id: 1, afiliacion_id: 82, pedido_id: 501,
    tipo: 'comision', monto_clp: 500, estado: entregado ? 'disponible' : 'pendiente', creado_en: '2026-11-24T12:00:00Z' }]);
  consultarSaldoAfiliado.mockImplementation(async () => ({ pendiente_clp: entregado ? 0 : 500,
    disponible_clp: disponible, retirado_clp: filas.reduce((suma, fila) => suma + fila.monto_clp, 300) }));
  consultarRetirosAfiliado.mockImplementation(async () => [...filas]);
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-a05', user: { id: 'estudiante-a05' } } } });
  fetchAnterior = global.fetch; urlAnterior = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  global.fetch = jest.fn(async (_, opciones) => {
    const cuerpo = JSON.parse(opciones.body); solicitudes.push(cuerpo);
    if (!filas.length) {
      disponible -= cuerpo.monto_clp;
      filas.push({ id: 1, monto_clp: cuerpo.monto_clp, referencia, creado_en: '2026-11-24T13:00:00Z' });
    }
    if (perdidas) { perdidas = false; throw new Error('Respuesta perdida tras confirmar'); }
    return { ok: true, status: 200, text: async () => JSON.stringify({ referencia, monto_clp: 500,
      estado: 'confirmado', destino: 'Cuenta de prueba CoffeeFast (destino ficticio)', disponible_clp: disponible }) };
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
  jest.restoreAllMocks();
});
test('misma cuenta: entrega, regreso a la app, retiro con respuesta perdida y reapertura coherentes', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await montar(); await pulsar('Historial');
  expect(texto()).toContain('Saldo disponible para retirar: $700'); expect(texto()).toContain('$500 · pendiente');
  entregar();
  const alVolver = listener.mock.calls.find(([evento]) => evento === 'change')[1];
  await act(async () => alVolver('active'));
  expect(texto()).toContain('Saldo disponible para retirar: $1.200');
  expect(texto()).toContain('$500 · disponible'); expect(texto()).not.toContain('$500 · pendiente');
  act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos').props.onChangeText('500'));
  await pulsar('Revisar solicitud de retiro simulado'); await pulsar('Confirmar retiro simulado');
  expect(texto()).toContain('No pudimos confirmar el retiro'); expect(disponible).toBe(700);
  await pulsar('Recuperar retiro simulado');
  expect(texto()).toContain(`Referencia del comprobante: ${referencia}`);
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(texto()).toContain('-$500 · confirmado');
  expect(texto()).not.toContain('No pudimos confirmar el retiro');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(solicitudes).toHaveLength(2); expect(solicitudes[1]).toEqual(solicitudes[0]); expect(filas).toHaveLength(1);
  act(() => tree.unmount()); tree = null; await montar(); await pulsar('Historial');
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
test('Actualizar saldo sincroniza también los movimientos tras entregar sin salir del historial', async () => {
  await montar(); await pulsar('Historial'); entregar();
  await pulsar('Actualizar saldo de comisiones');
  expect(texto()).toContain('Saldo disponible para retirar: $1.200');
  expect(texto()).toContain('$500 · disponible'); expect(texto()).not.toContain('$500 · pendiente');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('el regreso a primer plano actualiza saldo, comisiones y retiros aunque solicitudes devuelva 503', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await montar(); await pulsar('Historial');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(texto()).toContain('$500 · pendiente');
  expect(texto()).toContain('Todavía no tienes retiros registrados');
  entregar();
  filas.push({ id: 2, monto_clp: 300, referencia, creado_en: '2026-11-25T12:00:00Z' });
  consultarAfiliaciones.mockRejectedValueOnce(Object.assign(new Error('Servicio temporalmente no disponible'), { status: 503 }));
  const alVolver = listener.mock.calls.find(([evento]) => evento === 'change')[1];
  await act(async () => alVolver('active'));
  expect(texto()).toContain('No pudimos actualizar tus solicitudes');
  expect(texto()).toContain('Saldo disponible para retirar: $1.200');
  expect(texto()).toContain('$500 · disponible');
  expect(texto()).not.toContain('$500 · pendiente');
  expect(texto()).toContain(`Comprobante: ${referencia}`);
  expect(texto()).not.toContain('Todavía no tienes retiros registrados');
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([401, 403])('el refresco independiente no conserva el panel si solicitudes rechaza el acceso con %s', async status => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await montar(); await pulsar('Historial');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  consultarAfiliaciones.mockRejectedValue(Object.assign(new Error('Acceso rechazado'), { status }));
  const alVolver = listener.mock.calls.find(([evento]) => evento === 'change')[1];
  await act(async () => alVolver('active'));
  expect(texto()).toContain(status === 401 ? 'Tu sesión venció' : 'Tu cuenta no tiene permisos');
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(texto()).not.toContain('$500 · pendiente');
  expect(boton('Ganancias')).toBeUndefined();
  expect(boton('Historial')).toBeUndefined();
  expect(global.fetch).not.toHaveBeenCalled();
});
