import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import SaldoAfiliado from './SaldoAfiliado';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));
const saldo = { pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 };
let tree, fetchAnterior;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const campo = () => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Monto del retiro simulado en pesos chilenos');
const boton = etiqueta => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === etiqueta);
const pulsar = async etiqueta => act(async () => boton(etiqueta).props.onPress());
const monto = valor => act(() => campo().props.onChangeText(valor));
const montar = async () => act(async () => { tree = create(<SaldoAfiliado />); });
beforeEach(() => {
  consultarSaldoAfiliado.mockReset().mockResolvedValue(saldo);
  fetchAnterior = global.fetch;
  global.fetch = jest.fn(() => Promise.reject(new Error('No se permite enviar desde este formulario')));
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null; global.fetch = fetchAnterior;
});

test('monto válido muestra destino ficticio y revisión simulada sin envío ni débito', async () => {
  await montar();
  expect(texto()).toContain('Esta operación es simulada');
  expect(texto()).toContain('Cuenta de prueba CoffeeFast (destino ficticio)');
  monto('500');
  await pulsar('Revisar solicitud de retiro simulado');
  expect(texto()).toContain('Monto válido para revisar: $500');
  expect(texto()).toContain('todavía no se ha enviado');
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(texto()).toContain('Comisiones retiradas: $300');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(consultarSaldoAfiliado).toHaveBeenCalledTimes(1);
});
test.each([['0', 'mayor que $0'], ['701', 'no puede superar'], ['1000', 'no puede superar']])(
  'monto %s muestra error y no suma el pendiente al retirable', async (valor, mensaje) => {
    await montar(); monto(valor);
    await pulsar('Revisar solicitud de retiro simulado');
    expect(texto()).toContain(mensaje);
    expect(texto()).not.toContain('Monto válido para revisar');
    expect(texto()).toContain('Saldo disponible para retirar: $700');
    expect(global.fetch).not.toHaveBeenCalled();
  });
test('el límite exacto es válido y editar limpia la revisión anterior', async () => {
  await montar(); monto('700');
  await pulsar('Revisar solicitud de retiro simulado');
  expect(texto()).toContain('Monto válido para revisar: $700');
  monto('701');
  expect(texto()).not.toContain('Monto válido para revisar');
  await pulsar('Revisar solicitud de retiro simulado');
  expect(texto()).toContain('no puede superar');
});
test('recargar el saldo bloquea la captura e invalida el monto si el disponible baja', async () => {
  await montar(); monto('500');
  await pulsar('Revisar solicitud de retiro simulado');
  let resolve;
  consultarSaldoAfiliado.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
  await pulsar('Actualizar saldo de comisiones');
  expect(campo().props.editable).toBe(false);
  expect(boton('Revisar solicitud de retiro simulado').props.disabled).toBe(true);
  expect(texto()).not.toContain('Monto válido para revisar');
  await act(async () => resolve({ ...saldo, disponible_clp: 400 }));
  expect(campo().props.value).toBe('500');
  expect(texto()).not.toContain('Monto válido para revisar');
  await pulsar('Revisar solicitud de retiro simulado');
  expect(texto()).toContain('no puede superar tu saldo disponible de $400');
});
test('un saldo anterior conservado tras error no permite preparar la solicitud', async () => {
  await montar();
  consultarSaldoAfiliado.mockRejectedValueOnce(new Error('No pudimos consultar el saldo'));
  await pulsar('Actualizar saldo de comisiones');
  expect(texto()).toContain('Se conserva la última consulta');
  expect(campo().props.editable).toBe(false);
  const revisar = boton('Revisar solicitud de retiro simulado');
  expect(revisar.props.disabled).toBe(true);
  act(() => revisar.props.onPress());
  expect(texto()).not.toContain('Monto válido para revisar');
});
test('un error inicial de saldo no muestra un formulario con límite inventado', async () => {
  consultarSaldoAfiliado.mockRejectedValueOnce(new Error('No disponible'));
  await montar();
  expect(campo()).toBeUndefined();
  expect(boton('Revisar solicitud de retiro simulado')).toBeUndefined();
});
test('al cambiar de cuenta desaparecen el monto y la revisión anterior', async () => {
  await montar(); monto('500');
  await pulsar('Revisar solicitud de retiro simulado');
  consultarSaldoAfiliado.mockResolvedValue({ ...saldo, disponible_clp: 100 });
  await act(async () => tree.update(<SaldoAfiliado key="cuenta-b" />));
  expect(campo().props.value).toBe('');
  expect(texto()).not.toContain('Monto válido para revisar');
  expect(texto()).toContain('Saldo disponible para retirar: $100');
});
