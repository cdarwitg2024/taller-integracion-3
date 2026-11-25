import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { supabase } from '../../lib/supabase';
import SaldoAfiliado from './SaldoAfiliado';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));
let tree, fetchAnterior, urlAnterior, saldo, retiros, peticiones, perder, retener;
const referencia = '00000000-0000-4000-8000-000000000099';
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const campo = () => tree.root.findByType(TextInput);
const pulsar = async label => act(async () => { await boton(label).props.onPress(); });
const montar = async (cuenta = 'estudiante-a') => act(async () => { tree = create(<SaldoAfiliado key={cuenta} usuarioId={cuenta} />); });
const preparar = async () => { act(() => campo().props.onChangeText('500')); await pulsar('Revisar solicitud de retiro simulado'); };
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks();
  saldo = 700; retiros = new Map(); peticiones = []; perder = false; retener = null;
  consultarSaldoAfiliado.mockImplementation(async () => ({ pendiente_clp: 500, disponible_clp: saldo, retirado_clp: 700 - saldo }));
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-a', user: { id: 'estudiante-a' } } } });
  fetchAnterior = global.fetch; urlAnterior = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway-prueba';
  global.fetch = jest.fn(async (url, opciones) => {
    const cuerpo = JSON.parse(opciones.body); peticiones.push(cuerpo);
    expect(url).toBe('http://gateway-prueba/api/afiliados/retiros');
    const clave = cuerpo.clave_idempotencia;
    if (!retiros.has(clave)) {
      saldo -= cuerpo.monto_clp;
      retiros.set(clave, { monto_clp: cuerpo.monto_clp, estado: 'confirmado', referencia,
        destino: 'Cuenta de prueba CoffeeFast (destino ficticio)', disponible_clp: saldo });
    }
    if (perder) { perder = false; throw new Error('Respuesta perdida después del retiro'); }
    const resultado = { ok: true, status: 200, text: async () => JSON.stringify(retiros.get(clave)) };
    return retener ? new Promise(resolve => { retener.resolver = () => resolve(resultado); }) : resultado;
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount()); tree = null; global.fetch = fetchAnterior;
  if (urlAnterior === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = urlAnterior;
});
test('respuesta perdida: mismo cuerpo y comprobante, con un solo descuento', async () => {
  await montar(); await preparar(); perder = true;
  await pulsar('Confirmar retiro simulado');
  expect(texto()).toContain('Recupera la misma solicitud'); expect(saldo).toBe(200);
  expect(campo().props.editable).toBe(false);
  expect(boton('Revisar solicitud de retiro simulado')).toBeUndefined();
  await pulsar('Recuperar retiro simulado');
  expect(peticiones).toHaveLength(2); expect(peticiones[1]).toEqual(peticiones[0]);
  expect(retiros.size).toBe(1); expect(saldo).toBe(200);
  expect(texto()).toContain(`Referencia del comprobante: ${referencia}`);
  expect(texto()).toContain('Retiro simulado confirmado');
  expect(texto()).toContain('Saldo disponible para retirar: $200');
  expect(texto()).toContain('Comisiones retiradas: $500');
});
test('doble toque bloquea otro POST y la edición durante procesamiento', async () => {
  await montar(); await preparar(); retener = {};
  const confirmar = boton('Confirmar retiro simulado').props.onPress;
  let primero;
  await act(async () => { primero = confirmar(); confirmar(); });
  expect(peticiones).toHaveLength(1); expect(campo().props.editable).toBe(false);
  expect(boton('Confirmar retiro simulado').props.disabled).toBe(true);
  expect(boton('Confirmar retiro simulado').props.accessibilityState.busy).toBe(true);
  await act(async () => { retener.resolver(); await primero; }); expect(retiros.size).toBe(1);
});
test('salir y volver recupera el intento incluso con el saldo ya agotado', async () => {
  await montar(); act(() => campo().props.onChangeText('700'));
  await pulsar('Revisar solicitud de retiro simulado'); perder = true;
  await pulsar('Confirmar retiro simulado');
  act(() => tree.unmount()); tree = null; await montar();
  expect(texto()).toContain('Saldo disponible para retirar: $0'); expect(texto()).toContain('Retiro por recuperar: $700');
  await pulsar('Recuperar retiro simulado');
  expect(peticiones[1]).toEqual(peticiones[0]); expect(retiros.size).toBe(1);
  expect(texto()).toContain('Retiro simulado confirmado');
});
test('otra cuenta no muestra una respuesta tardía ni el comprobante anterior', async () => {
  await montar(); await preparar(); retener = {};
  let pendiente; await act(async () => { pendiente = boton('Confirmar retiro simulado').props.onPress(); });
  await act(async () => tree.update(<SaldoAfiliado key="estudiante-b" usuarioId="estudiante-b" />));
  await act(async () => { retener.resolver(); await pendiente; });
  expect(texto()).not.toContain(referencia); expect(texto()).not.toContain('Retiro simulado confirmado');
  expect(campo().props.value).toBe('');
});
test.each([401, 403])('HTTP %s retira el saldo y no ofrece reintento', async status => {
  await montar(); await preparar();
  global.fetch.mockResolvedValueOnce({ ok: false, status, text: async () => JSON.stringify({ error: 'sin_acceso' }) });
  await pulsar('Confirmar retiro simulado');
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(texto()).toContain(status === 403 ? 'no tiene permisos' : 'sesión venció');
  expect(boton('Recuperar retiro simulado')).toBeUndefined(); expect(retiros.size).toBe(0);
});
