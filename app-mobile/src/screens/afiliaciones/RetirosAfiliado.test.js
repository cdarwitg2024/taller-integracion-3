import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import RetirosAfiliado from './RetirosAfiliado';
import { consultarRetirosAfiliado } from '../../services/retirosAfiliado';
jest.mock('../../services/retirosAfiliado', () => ({ consultarRetirosAfiliado: jest.fn() }));
const referencia = 'f876c63c-83b4-4705-9046-c11122223333';
const filas = [
  { id: 1, monto_clp: 100, creado_en: '2026-11-20T12:00:00Z', referencia: null },
  { id: 2, monto_clp: 300, creado_en: '2026-11-23T12:00:00Z', referencia },
];
let tree;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const montar = async revision => act(async () => { tree = create(<RetirosAfiliado revision={revision} />); });
const actualizar = async () => act(async () => boton('Actualizar historial de retiros').props.onPress());
beforeEach(() => { consultarRetirosAfiliado.mockReset().mockResolvedValue(filas); });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
test('muestra importe de salida, fecha, estado confirmado y referencia real, más el retiro histórico sin comprobante', async () => {
  await montar();
  expect(texto()).toContain('-$300 · confirmado');
  expect(texto()).toContain(new Date(filas[1].creado_en).toLocaleString('es-CL'));
  expect(texto()).toContain(`Comprobante: ${referencia}`);
  expect(texto()).toContain('Sin comprobante: retiro histórico');
  expect(texto()).toContain('No son transferencias bancarias reales');
  expect(texto().indexOf('-$300')).toBeLessThan(texto().indexOf('-$100'));
});
test('localiza por referencia completa o fragmento sin distinguir mayúsculas y recupera la lista al limpiar', async () => {
  await montar();
  const buscar = async valor => act(async () => tree.root.findByType(TextInput).props.onChangeText(valor));
  await buscar(`  ${referencia.toUpperCase()}  `);
  expect(texto()).toContain('-$300'); expect(texto()).not.toContain('-$100');
  await buscar('C1112222'); expect(texto()).toContain('-$300');
  await buscar('no-existe'); expect(texto()).toContain('No hay retiros con esa referencia');
  await act(async () => boton('Limpiar búsqueda de comprobante').props.onPress());
  expect(texto()).toContain('-$300'); expect(texto()).toContain('-$100');
  expect(consultarRetirosAfiliado).toHaveBeenCalledTimes(1);
});
test('distingue carga de vacío y bloquea la actualización durante una consulta', async () => {
  let resolver;
  consultarRetirosAfiliado.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  await montar();
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(boton('Actualizar historial de retiros').props.disabled).toBe(true);
  expect(texto()).not.toContain('Todavía no tienes retiros');
  await act(async () => resolver([]));
  expect(texto()).toContain('Todavía no tienes retiros registrados');
});
test('error y reintento conservan el último historial y la búsqueda sin simular un saldo', async () => {
  await montar();
  await act(async () => tree.root.findByType(TextInput).props.onChangeText(referencia));
  consultarRetirosAfiliado.mockRejectedValueOnce(new Error('Sin red'));
  await actualizar();
  expect(texto()).toContain('Se conserva la última consulta'); expect(texto()).toContain('-$300');
  expect(texto()).not.toContain('-$100');
  await actualizar(); expect(texto()).not.toContain('Sin red'); expect(texto()).toContain('-$300');
});
test.each([401, 403])('error %s retira los comprobantes anteriores y no ofrece reintentar con permisos inválidos', async status => {
  await montar();
  consultarRetirosAfiliado.mockRejectedValueOnce(Object.assign(new Error('Acceso restringido'), { status }));
  await actualizar();
  expect(texto()).not.toContain(referencia); expect(texto()).not.toContain('-$300');
  expect(boton('Actualizar historial de retiros')).toBeUndefined();
});
test('descarta una respuesta atrasada tras renovar el perfil', async () => {
  let resolver;
  consultarRetirosAfiliado.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; })).mockResolvedValueOnce([]);
  await montar(1);
  await act(async () => tree.update(<RetirosAfiliado revision={2} />));
  await act(async () => resolver(filas));
  expect(texto()).toContain('Todavía no tienes retiros registrados'); expect(texto()).not.toContain(referencia);
});
