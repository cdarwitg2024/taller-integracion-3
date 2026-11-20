import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import SaldoAfiliado from './SaldoAfiliado';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));
const inicial = { pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 };
let tree;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = () => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === 'Actualizar saldo de comisiones');
const montar = async () => act(async () => { tree = create(<SaldoAfiliado />); });
const pulsar = async () => act(async () => boton().props.onPress());
const diferida = () => {
  let resolve; const promise = new Promise(ok => { resolve = ok; });
  return { promise, resolve };
};
beforeEach(() => { consultarSaldoAfiliado.mockReset().mockResolvedValue(inicial); });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });

test('durante carga no inventa saldo cero ni habilita otro refresco', async () => {
  const carga = diferida(); consultarSaldoAfiliado.mockReturnValue(carga.promise);
  await montar();
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(boton().props.disabled).toBe(true);
  await act(async () => carga.resolve(inicial));
  expect(boton().props.disabled).toBe(false);
});
test('muestra pendiente, disponible neto y retirado del servidor sin descontar dos veces', async () => {
  await montar();
  expect(texto()).toContain('Comisiones pendientes: $500');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(texto()).toContain('Comisiones retiradas: $300');
  expect(texto()).not.toContain('Saldo disponible para retirar: $1.200');
  expect(texto()).not.toContain('Saldo disponible para retirar: $400');
  expect(texto()).toContain('Las comisiones pendientes no están disponibles para retiro');
});
test('al actualizar tras entregar, la comisión deja de ser pendiente y se muestra disponible', async () => {
  await montar();
  consultarSaldoAfiliado.mockResolvedValue({ pendiente_clp: 0, disponible_clp: 1200, retirado_clp: 300 });
  await pulsar();
  expect(texto()).toContain('Comisiones pendientes: $0');
  expect(texto()).toContain('Saldo disponible para retirar: $1.200');
  expect(texto()).toContain('Comisiones retiradas: $300');
});
test('error inicial no aparece como saldo cero; un reintento recupera los importes', async () => {
  consultarSaldoAfiliado.mockRejectedValueOnce(new Error('No pudimos consultar el saldo. Intenta nuevamente.'));
  await montar();
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(texto()).toContain('No pudimos consultar el saldo');
  await pulsar();
  expect(texto()).toContain('Saldo disponible para retirar: $700');
});
test('error transitorio conserva los valores anteriores con un aviso explícito', async () => {
  await montar();
  consultarSaldoAfiliado.mockRejectedValueOnce(new Error('No pudimos consultar el saldo. Intenta nuevamente.'));
  await pulsar();
  expect(texto()).toContain('Se conserva la última consulta');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
});
test.each([401, 403])('HTTP %s retira los importes anteriores', async status => {
  await montar();
  consultarSaldoAfiliado.mockRejectedValueOnce(Object.assign(new Error('Acceso no autorizado'), { status }));
  await pulsar();
  expect(texto()).not.toContain('Saldo disponible para retirar:');
  expect(texto()).not.toContain('Se conserva la última consulta');
  if (status === 403) expect(boton()).toBeUndefined();
});
test('otra cuenta no recibe la respuesta pendiente de la anterior', async () => {
  const anterior = diferida(); consultarSaldoAfiliado.mockReturnValueOnce(anterior.promise);
  await montar();
  consultarSaldoAfiliado.mockResolvedValue({ pendiente_clp: 0, disponible_clp: 0, retirado_clp: 0 });
  await act(async () => tree.update(<SaldoAfiliado key="cuenta-b" />));
  await act(async () => anterior.resolve(inicial));
  expect(texto()).toContain('Saldo disponible para retirar: $0');
  expect(texto()).not.toContain('$700');
});
