import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import OportunidadesScreen from './OportunidadesScreen';
import { apiGet } from '../../services/backendClient';

jest.mock('../../services/backendClient', () => ({ apiGet: jest.fn() }));
jest.mock('../../services/afiliaciones', () => ({ solicitarAfiliacion: jest.fn() }));
const ahora = Date.parse('2026-11-18T12:00:00Z');
const cafeterias = [{ id: 7, nombre: 'Norte' }, { id: 8, nombre: 'Sur' }];
const campana = (cambios = {}) => ({
  id: 31, nombre: 'Campaña Norte', cafeteria_id: 7, cafeteria_nombre: 'Norte',
  tipo: 'carrito_completo', estado: 'activa', estado_vigencia: 'en_curso',
  vigencia_desde: '2026-11-01T00:00:00Z', vigencia_hasta: '2026-12-01T00:00:00Z',
  tasa_descuento: 15, tasa_comision: 10, ...cambios,
});
let tree;
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias'
    ? { data: cafeterias } : { campanas: [campana()] });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = etiqueta => tree.root.findAllByType(TouchableOpacity)
  .find(n => n.props.accessibilityLabel === etiqueta);
const pulsar = async etiqueta => act(async () => boton(etiqueta).props.onPress());
async function montar() {
  await act(async () => { tree = create(<OportunidadesScreen />); });
  await pulsar('Ver campañas de Norte');
}

test('abrir condiciones distingue ahorro del referido, pago y ganancia del afiliado con tasas reales', async () => {
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  expect(texto()).toContain('Beneficio de tu referido');
  expect(texto()).toContain('Tu ganancia como afiliado');
  expect(texto()).toContain('Tu referido ahorra $1.500 y paga $8.500.');
  expect(texto()).toContain('Tú ganas $850 cuando se entrega ese pedido.');
  expect(texto()).toContain('se calcula sobre $8.500, después del descuento');
  expect(texto()).toContain('no es una cotización ni una ganancia registrada');
  expect(boton('Ocultar condiciones de Campaña Norte').props.accessibilityState.expanded).toBe(true);
});

test('explica aprobación, beneficio único, código propio, cancelación y vigencia sin afirmar elegibilidad personal', async () => {
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  expect(texto()).toContain('aprobar tu afiliación y asignarte un código');
  expect(texto()).toContain('Ver esta campaña no significa que ya estés aprobado');
  expect(texto()).toContain('una sola vez en todo CoffeeFast, aunque ya haya comprado antes');
  expect(texto()).toContain('en esa compra tu comisión es $0');
  expect(texto()).toContain('el comprador recupera su beneficio y la comisión queda en $0');
  expect(texto()).toContain('activa y vigente al confirmar el pago');
  expect(texto()).toContain('Los pedidos ya pagados conservan sus condiciones');
  expect(texto()).toContain('productos en oferta');
});

test('mostrar y ocultar condiciones conserva el listado y no envía consultas ni solicitudes nuevas', async () => {
  await montar();
  const consultas = apiGet.mock.calls.length;
  await pulsar('Ver condiciones de Campaña Norte');
  await pulsar('Ocultar condiciones de Campaña Norte');
  expect(texto()).not.toContain('Ejemplo de compra referida');
  expect(texto()).toContain('Campaña Norte');
  expect(apiGet).toHaveBeenCalledTimes(consultas);
  expect(boton('Ver condiciones de Campaña Norte').props.accessibilityState.expanded).toBe(false);
});

test('al cambiar de cafetería desaparecen las condiciones de la anterior y usa las tasas nuevas', async () => {
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: [ruta.includes('/7/') ? campana() : campana({
      id: 41, nombre: 'Campaña Sur', cafeteria_id: 8, cafeteria_nombre: 'Sur', tasa_descuento: 20, tasa_comision: 5,
    })] });
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  await pulsar('Ver campañas de Sur');
  expect(texto()).not.toContain('Condiciones de Campaña Norte');
  expect(texto()).not.toContain('Ejemplo de compra referida');
  await pulsar('Ver condiciones de Campaña Sur');
  expect(texto()).toContain('Tu referido ahorra $2.000 y paga $8.000.');
  expect(texto()).toContain('Tú ganas $400 cuando se entrega ese pedido.');
  expect(texto()).not.toContain('$850');
});

test('el ejemplo se recalcula con las tasas recibidas al actualizar la misma campaña', async () => {
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  apiGet.mockResolvedValue({ campanas: [campana({ tasa_descuento: 20, tasa_comision: 5 })] });
  await pulsar('Actualizar campañas');
  expect(texto()).toContain('Tú ganas $400 cuando se entrega ese pedido.');
  expect(texto()).not.toContain('$850');
});

test('las tasas nulas muestran que faltan datos y no inventan un ejemplo numérico', async () => {
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: [campana({ tasa_comision: null })] });
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  expect(texto()).toContain('No especificado');
  expect(texto()).toContain('El ejemplo estará disponible cuando se informen');
  expect(texto()).not.toContain('Tu referido ahorra');
  expect(texto()).not.toContain('Tú ganas');
});

test('tasas cero conservan el ejemplo y no se confunden con datos ausentes', async () => {
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: [campana({ tasa_descuento: 0, tasa_comision: 0 })] });
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  expect(texto()).toContain('Tu referido ahorra $0 y paga $10.000.');
  expect(texto()).toContain('Tú ganas $0 cuando se entrega ese pedido.');
  expect(texto()).not.toContain('El ejemplo estará disponible');
});

test('al vencer la campaña retira también sus condiciones aunque estén desplegadas', async () => {
  jest.useFakeTimers({ now: ahora });
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: [campana({ vigencia_hasta: new Date(ahora + 1000).toISOString() })] });
  await montar();
  await pulsar('Ver condiciones de Campaña Norte');
  act(() => jest.advanceTimersByTime(1000));
  expect(texto()).not.toContain('Ejemplo de compra referida');
  expect(texto()).toContain('No hay oportunidades disponibles');
});

test('no aplica condiciones de carrito completo a un alcance diferente', async () => {
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: [campana({ tipo: 'producto' })] });
  await montar();
  expect(boton('Ver condiciones de Campaña Norte')).toBeUndefined();
});
