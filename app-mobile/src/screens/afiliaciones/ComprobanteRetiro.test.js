import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';
import { supabase } from '../../lib/supabase';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
import { consultarRetirosAfiliado } from '../../services/retirosAfiliado';
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../../services/afiliaciones', () => ({
  consultarAfiliaciones: jest.fn(async () => mockSolicitudes),
  consultarMovimientosComision: jest.fn(async () => []),
  resumirComisiones: () => ({ disponible: 0, pendiente: 0 }),
}));
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));
jest.mock('../../services/retirosAfiliado', () => ({ consultarRetirosAfiliado: jest.fn() }));
const mockSolicitudes = [{ id: 82, cafeteria_id: 7, campana_id: 31, estado: 'aprobada', codigo: 'PRUEBA', codigo_activo: true }];
const referencia = '00000000-0000-4000-8000-000000000099';
let tree, fetchAnterior, urlAnterior, saldo, filas;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const campoMonto = () => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos');
const pulsar = async label => act(async () => { await boton(label).props.onPress(); });
const montar = async (usuarioId = 'estudiante-a') => act(async () => { tree = create(<MisAfiliacionesScreen usuarioId={usuarioId} onBack={() => {}} />); });
const confirmar = async () => {
  act(() => campoMonto().props.onChangeText('500'));
  await pulsar('Revisar solicitud de retiro simulado'); await pulsar('Confirmar retiro simulado');
};
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks(); saldo = 700; filas = [];
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-a', user: { id: 'estudiante-a' } } } });
  consultarSaldoAfiliado.mockImplementation(async () => ({ pendiente_clp: 300, disponible_clp: saldo, retirado_clp: 700 - saldo }));
  consultarRetirosAfiliado.mockImplementation(async () => [...filas]);
  fetchAnterior = global.fetch; urlAnterior = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  global.fetch = jest.fn(async (_, opciones) => {
    const { monto_clp } = JSON.parse(opciones.body);
    saldo -= monto_clp;
    filas.push({ id: 1, monto_clp, referencia, creado_en: '2026-11-24T12:00:00Z' });
    return { ok: true, status: 200, text: async () => JSON.stringify({ monto_clp, referencia, estado: 'confirmado',
      destino: 'Cuenta de prueba CoffeeFast (destino ficticio)', disponible_clp: saldo }) };
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
});
test('confirmar desde Historial refresca una vez saldo y filas con el mismo importe y referencia', async () => {
  await montar(); await pulsar('Historial');
  expect(texto()).toContain('Todavía no tienes retiros registrados');
  const lecturasSaldo = consultarSaldoAfiliado.mock.calls.length, lecturasHistorial = consultarRetirosAfiliado.mock.calls.length;
  await confirmar();
  expect(global.fetch).toHaveBeenCalledTimes(1); expect(saldo).toBe(200);
  expect(consultarSaldoAfiliado).toHaveBeenCalledTimes(lecturasSaldo + 1);
  expect(consultarRetirosAfiliado).toHaveBeenCalledTimes(lecturasHistorial + 1);
  expect(texto()).toContain('Monto: $500'); expect(texto()).toContain('Estado: confirmado');
  expect(texto()).toContain(`Referencia del comprobante: ${referencia}`);
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(texto()).toContain('-$500 · confirmado');
  expect(texto()).toContain('Saldo disponible para retirar: $200'); expect(texto()).not.toContain('Saldo disponible para retirar: -$300');
});
test('Ver retiro en historial localiza la referencia; reabrir conserva importe sin otro POST', async () => {
  await montar(); await pulsar('Ganancias'); await confirmar();
  await pulsar('Ver retiro en historial');
  const buscar = () => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Buscar retiro por referencia de comprobante');
  expect(buscar().props.value).toBe(referencia);
  act(() => buscar().props.onChangeText('no-existe'));
  expect(texto()).toContain('No hay retiros con esa referencia');
  await pulsar('Ver retiro en historial');
  expect(buscar().props.value).toBe(referencia);
  expect(texto()).toContain(`Comprobante: ${referencia}`);
  act(() => tree.unmount()); tree = null; await montar(); await pulsar('Historial');
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(texto()).toContain('-$500 · confirmado');
  expect(texto()).toContain('Saldo disponible para retirar: $200'); expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('si falla actualizar el saldo, conserva comprobante y no presenta el saldo anterior como actual', async () => {
  await montar(); await pulsar('Ganancias');
  consultarSaldoAfiliado.mockRejectedValueOnce(new Error('Sin red al consultar saldo'));
  await confirmar();
  expect(texto()).toContain('Retiro simulado confirmado'); expect(texto()).toContain(referencia);
  expect(texto()).toContain('Saldo disponible al confirmar: $200');
  expect(texto()).not.toContain('Saldo disponible para retirar: $700');
  expect(texto()).not.toContain('Saldo disponible para retirar: $200');
  expect(texto()).toContain('Sin red al consultar saldo');
  await pulsar('Actualizar saldo de comisiones');
  expect(texto()).toContain('Saldo disponible para retirar: $200'); expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('una lectura del historial anterior al retiro no borra la nueva fila al llegar tarde', async () => {
  let resolver;
  consultarRetirosAfiliado.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  await montar(); await pulsar('Historial'); await confirmar();
  expect(texto()).toContain(`Comprobante: ${referencia}`);
  await act(async () => resolver([]));
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(texto()).not.toContain('Todavía no tienes retiros registrados');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('fallar el refresco del historial permite reintentar la lectura sin repetir el retiro', async () => {
  await montar(); await pulsar('Historial');
  consultarRetirosAfiliado.mockRejectedValueOnce(new Error('Sin red al consultar historial'));
  await confirmar();
  expect(texto()).toContain('Sin red al consultar historial'); expect(texto()).toContain('Retiro simulado confirmado');
  await pulsar('Actualizar historial de retiros');
  expect(texto()).toContain(`Comprobante: ${referencia}`); expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('reabrir Ganancias con saldo en 503 recupera el comprobante guardado sin otro POST ni saldo historico vigente', async () => {
  await montar(); await pulsar('Ganancias'); await confirmar();
  expect(saldo).toBe(200);
  const guardado = await AsyncStorage.getItem('@coffeefast/intento-retiro/estudiante-a');
  expect(JSON.parse(guardado).comprobante.referencia).toBe(referencia);
  act(() => tree.unmount()); tree = null;
  consultarSaldoAfiliado.mockRejectedValueOnce(Object.assign(new Error('Saldo temporalmente no disponible'), { status: 503 }));
  await montar(); await pulsar('Ganancias');
  expect(texto()).toContain('Saldo temporalmente no disponible');
  expect(texto()).toContain('Retiro simulado confirmado');
  expect(texto()).toContain(`Referencia del comprobante: ${referencia}`);
  expect(texto()).toContain('Monto: $500'); expect(texto()).toContain('Estado: confirmado');
  expect(texto()).toContain('Saldo disponible al confirmar: $200');
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(campoMonto()).toBeUndefined();
  expect(boton('Preparar otro retiro simulado')).toBeUndefined();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('@coffeefast/intento-retiro/estudiante-a')).toBe(guardado);
  // El saldo vigente puede haber cambiado desde la instantánea del comprobante.
  saldo = 100;
  await pulsar('Actualizar saldo de comisiones');
  expect(texto()).toContain('Saldo disponible para retirar: $100');
  expect(texto()).toContain('Saldo disponible al confirmar: $200');
  expect(texto()).toContain(referencia); expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([401, 403])('reabrir con saldo rechazado por HTTP %s no recupera el comprobante en pantalla', async status => {
  await montar(); await pulsar('Ganancias'); await confirmar();
  act(() => tree.unmount()); tree = null;
  consultarSaldoAfiliado.mockRejectedValueOnce(Object.assign(new Error('Acceso rechazado'), { status }));
  await montar(); await pulsar('Ganancias');
  expect(texto()).toContain('Acceso rechazado');
  expect(texto()).not.toContain(referencia);
  expect(texto()).not.toContain('Retiro simulado confirmado');
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(boton('Recuperar retiro simulado')).toBeUndefined();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('otra cuenta con error temporal de saldo no lee el comprobante de la cuenta anterior', async () => {
  await montar(); await pulsar('Ganancias'); await confirmar();
  act(() => tree.unmount()); tree = null;
  consultarSaldoAfiliado.mockRejectedValueOnce(Object.assign(new Error('Saldo temporalmente no disponible'), { status: 503 }));
  await montar('estudiante-b'); await pulsar('Ganancias');
  expect(texto()).toContain('Saldo temporalmente no disponible');
  expect(texto()).not.toContain(referencia);
  expect(texto()).not.toContain('Retiro simulado confirmado');
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(campoMonto()).toBeUndefined();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('@coffeefast/intento-retiro/estudiante-b')).toBeNull();
});
