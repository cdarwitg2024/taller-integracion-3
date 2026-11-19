import React from 'react';
import { AppState, Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import OportunidadesScreen from './OportunidadesScreen';
import { apiGet } from '../../services/backendClient';
import * as campanasService from '../../services/campanasAfiliados';

jest.mock('../../services/backendClient', () => ({ apiGet: jest.fn() }));
const ahora = Date.parse('2026-11-17T12:00:00Z');
const cafeterias = [{ id: 7, nombre: 'Norte' }, { id: 8, nombre: 'Sur' }];
const campana = (cambios = {}) => ({
  id: 31, nombre: 'Campaña Norte activa', estado: 'activa',
  cafeteria_id: 7, cafeteria_nombre: 'Norte', tipo: 'carrito_completo', estado_vigencia: 'en_curso',
  tasa_descuento: 15, tasa_comision: 10,
  vigencia_desde: '2026-11-01T00:00:00Z', vigencia_hasta: '2026-12-01T00:00:00Z', ...cambios,
});
let tree;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias'
    ? { data: cafeterias } : { campanas: [] });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
const montar = async () => act(async () => { tree = create(<OportunidadesScreen />); });
const pulsar = async etiqueta => act(async () => tree.root.findAllByType(TouchableOpacity)
  .find(nodo => nodo.props.accessibilityLabel === etiqueta).props.onPress());
const texto = () => tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children)
  .filter(valor => typeof valor === 'string').join(' ');
const diferida = () => {
  let resolve, reject;
  const promise = new Promise((ok, fallo) => { resolve = ok; reject = fallo; });
  return { promise, resolve, reject };
};

test('exige elegir una cafetería real del catálogo antes de consultar campañas', async () => {
  await montar();
  expect(apiGet).toHaveBeenCalledTimes(1);
  expect(texto()).toContain('Elige una cafetería');
  expect(texto()).not.toContain('No hay oportunidades disponibles');
});

test('con activa, pausada y vencida muestra solo la activa con sus tasas y vigencia', async () => {
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias } : { campanas: [
    campana(), campana({ id: 32, nombre: 'Campaña pausada', estado: 'pausada' }),
    campana({ id: 33, nombre: 'Campaña vencida', vigencia_hasta: '2026-11-16T00:00:00Z' }),
  ] });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('Campaña Norte activa');
  expect(texto()).toContain('15%');
  expect(texto()).toContain('carrito completo');
  expect(texto()).not.toContain('Descuento en oferta');
  expect(texto()).toContain('10%');
  expect(texto()).toContain('Hasta:');
  expect(texto()).not.toContain('Campaña pausada');
  expect(texto()).not.toContain('Campaña vencida');
});

test('sin campañas muestra el estado vacío después de una respuesta exitosa', async () => {
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('No hay oportunidades disponibles');
});

test.each([501, 401, 403, 503])('HTTP %s muestra error y reintento, sin anunciar vacío', async status => {
  let intentos = 0;
  apiGet.mockImplementation(async ruta => {
    if (ruta === '/api/cafeterias') return { data: cafeterias };
    if (++intentos === 1) throw Object.assign(new Error('fallo_controlado'), { status });
    return { campanas: [campana()] };
  });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).not.toContain('No hay oportunidades disponibles');
  if (status === 501) expect(texto()).toContain('aún no está disponible');
  if (status === 401) expect(texto()).toContain('Tu sesión venció');
  if (status === 403) expect(texto()).toContain('No tienes permiso');
  await pulsar('Reintentar campañas');
  expect(texto()).toContain('Campaña Norte activa');
});

test('un error de catálogo se puede reintentar y no muestra cafeterías inventadas', async () => {
  apiGet.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ data: cafeterias });
  await montar();
  expect(texto()).not.toContain('Ver campañas de Norte');
  await pulsar('Reintentar cafeterías');
  expect(texto()).toContain('Ver campañas de Norte');
});

test.each(['exito', 'error'])('una respuesta atrasada de Norte (%s) no reemplaza las campañas de Sur', async resultado => {
  const norte = diferida();
  apiGet.mockImplementation(ruta => {
    if (ruta === '/api/cafeterias') return Promise.resolve({ data: cafeterias });
    if (ruta.includes('/7/')) return norte.promise;
    return Promise.resolve({ campanas: [campana({ id: 41, cafeteria_id: 8, cafeteria_nombre: 'Sur', nombre: 'Campaña Sur activa' })] });
  });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('Cargando campañas');
  await pulsar('Ver campañas de Sur');
  await act(async () => resultado === 'exito' ? norte.resolve({ campanas: [campana()] }) : norte.reject(new Error('fallo tardío')));
  expect(texto()).toContain('Campaña Sur activa');
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(texto()).not.toContain('No pudimos cargar');
});

test('cambiar de cafetería oculta inmediatamente el listado anterior mientras llega el nuevo', async () => {
  const sur = diferida();
  apiGet.mockImplementation(ruta => {
    if (ruta === '/api/cafeterias') return Promise.resolve({ data: cafeterias });
    return ruta.includes('/7/') ? Promise.resolve({ campanas: [campana()] }) : sur.promise;
  });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('Campaña Norte activa');
  await pulsar('Ver campañas de Sur');
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(texto()).toContain('Cargando campañas');
  await act(async () => sur.resolve({ campanas: [] }));
});

test('al vencer una campaña con la pantalla abierta se oculta y aparece el vacío', async () => {
  jest.useFakeTimers({ now: ahora });
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias'
    ? { data: cafeterias } : { campanas: [campana({ vigencia_hasta: new Date(ahora + 1000).toISOString() })] });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('Campaña Norte activa');
  act(() => jest.advanceTimersByTime(1000));
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(texto()).toContain('No hay oportunidades disponibles');
});

test('si la última campaña vence entre el render y el efecto se oculta inmediatamente', async () => {
  jest.useFakeTimers({ now: ahora });
  const fin = ahora + 1000;
  const filtrar = campanasService.filtrarCampanasActivas;
  let cruzoVencimiento = false;
  jest.spyOn(campanasService, 'filtrarCampanasActivas').mockImplementation((...args) => {
    const visibles = filtrar(...args);
    if (visibles.length && !cruzoVencimiento) {
      // La tarjeta ya fue elegida para este render; el efecto aún no se ejecutó.
      cruzoVencimiento = true;
      jest.setSystemTime(fin);
    }
    return visibles;
  });
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias'
    ? { data: cafeterias } : { campanas: [campana({ vigencia_hasta: new Date(fin).toISOString() })] });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(cruzoVencimiento).toBe(true);
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(texto()).toContain('No hay oportunidades disponibles');
  act(() => jest.advanceTimersByTime(5000));
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(jest.getTimerCount()).toBe(0);
});

test('volver al primer plano vuelve a consultar para detectar pausas nuevas', async () => {
  const add = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  let intentos = 0;
  apiGet.mockImplementation(async ruta => ruta === '/api/cafeterias' ? { data: cafeterias }
    : { campanas: ++intentos === 1 ? [campana()] : [] });
  await montar();
  await pulsar('Ver campañas de Norte');
  await act(async () => add.mock.calls[0][1]('active'));
  expect(texto()).not.toContain('Campaña Norte activa');
  expect(texto()).toContain('No hay oportunidades disponibles');
});

test('desmontar retira el listener y el vencimiento; una respuesta pendiente no vuelve a publicarse', async () => {
  jest.useFakeTimers({ now: ahora });
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const pendiente = diferida();
  let intentos = 0;
  apiGet.mockImplementation(ruta => {
    if (ruta === '/api/cafeterias') return Promise.resolve({ data: cafeterias });
    return ++intentos === 1 ? Promise.resolve({ campanas: [campana()] }) : pendiente.promise;
  });
  await montar();
  await pulsar('Ver campañas de Norte');
  expect(jest.getTimerCount()).toBe(1);
  await pulsar('Actualizar campañas');
  act(() => tree.unmount());
  tree = null;
  await act(async () => pendiente.resolve({ campanas: [campana()] }));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
