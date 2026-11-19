import React from 'react';
import { AppState, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';
import { consultarAfiliaciones, solicitarAfiliacion, consultarMovimientosComision } from '../../services/afiliaciones';

jest.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn() } }));
jest.mock('../../services/afiliaciones', () => ({
  ...jest.requireActual('../../services/afiliaciones'),
  consultarAfiliaciones: jest.fn(), solicitarAfiliacion: jest.fn(), consultarMovimientosComision: jest.fn(),
}));
jest.mock('../../services/campanasAfiliados', () => ({
  listarCafeteriasAfiliados: jest.fn(async () => [{ id: 7, nombre: 'Norte' }]),
  listarCampanasActivas: jest.fn(async () => [{ id: 31, nombre: 'Campaña Norte', cafeteria_id: 7,
    cafeteria_nombre: 'Norte', tipo: 'carrito_completo', estado: 'activa', estado_vigencia: 'en_curso',
    vigencia_desde: '2026-01-01T00:00:00Z', vigencia_hasta: '2099-01-01T00:00:00Z', tasa_descuento: 15, tasa_comision: 10 }]),
  filtrarCampanasActivas: filas => filas,
}));
const pendiente = { id: 82, cafeteria_id: 7, campana_id: 31, estado: 'pendiente' };
const aprobada = { ...pendiente, estado: 'aprobada', codigo: 'CF-DEL-SERVIDOR', codigo_activo: true };
const movimientos = [{ id: 1, afiliacion_id: 82, pedido_id: 501, tipo: 'comision', estado: 'disponible', monto_clp: 850, creado_en: '2026-11-18T12:00:00Z' }];
let tree, perfil;
beforeEach(() => {
  perfil = [];
  consultarAfiliaciones.mockImplementation(async () => perfil);
  consultarMovimientosComision.mockResolvedValue(movimientos);
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.restoreAllMocks(); jest.clearAllMocks();
});
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const pulsar = async label => act(async () => boton(label).props.onPress());
const montar = async () => act(async () => { tree = create(<MisAfiliacionesScreen nombreUsuario="Estudiante A06" onBack={() => {}} />); });
const diferida = () => {
  let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test.each(['pendiente', 'rechazada'])('%s se muestra sin código, ganancias, historial ni acciones de retiro', async estado => {
  perfil = [{ ...aprobada, estado }];
  await montar();
  expect(texto()).toContain(estado === 'pendiente' ? 'Solicitud pendiente' : 'Solicitud rechazada');
  expect(texto()).not.toContain('CF-DEL-SERVIDOR');
  expect(boton('Ganancias')).toBeUndefined();
  expect(boton('Historial')).toBeUndefined();
  expect(boton('Mis códigos')).toBeUndefined();
  expect(consultarMovimientosComision).not.toHaveBeenCalled();
  expect(texto()).not.toContain('CF-DEL-SERVIDOR');
  expect(consultarMovimientosComision).not.toHaveBeenCalled();
});

test('la aprobación habilita el código del servidor, ganancias e historial reales', async () => {
  perfil = [aprobada];
  await montar();
  expect(texto()).toContain('CF-DEL-SERVIDOR');
  expect(boton('Ganancias')).toBeDefined();
  expect(boton('Historial')).toBeDefined();
  await pulsar('Ganancias');
  expect(texto()).toContain('Saldo de comisiones disponibles: $850');
  await pulsar('Historial');
  expect(texto()).toContain('Comisión · Pedido #501');
  expect(texto()).toContain('$850 · disponible');
});

test('pendiente pasa a aprobada al volver al foreground, sin volver a enviar la solicitud', async () => {
  const add = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  perfil = [pendiente];
  await montar();
  perfil = [aprobada];
  await act(async () => add.mock.calls.find(([evento]) => evento === 'change')[1]('active'));
  expect(texto()).toContain('CF-DEL-SERVIDOR');
  expect(boton('Ganancias')).toBeDefined();
  expect(solicitarAfiliacion).not.toHaveBeenCalled();
});

test('desactivar el código conserva el saldo y el historial al actualizar y reabrir', async () => {
  perfil = [aprobada];
  await montar();
  await pulsar('Ganancias');
  perfil = [{ ...aprobada, codigo_activo: false }];
  await pulsar('Actualizar mis solicitudes');
  expect(texto()).toContain('El código está desactivado');
  expect(texto()).toContain('Saldo de comisiones disponibles: $850');
  await pulsar('Mis códigos');
  expect(texto()).toContain('Código desactivado: ya no se puede usar');
  expect(texto()).toContain('CF-DEL-SERVIDOR');
  await pulsar('Historial');
  expect(texto()).toContain('Comisión · Pedido #501');
  expect(texto()).toContain('Saldo de comisiones disponibles: $850');
});

test('un error inicial no simula aprobación ni saldo cero; el reintento recupera el estado', async () => {
  consultarAfiliaciones.mockRejectedValueOnce(new Error('503'));
  await montar();
  expect(texto()).toContain('No pudimos actualizar tus solicitudes');
  expect(boton('Ganancias')).toBeUndefined();
  expect(texto()).not.toContain('$0');
  perfil = [aprobada];
  await pulsar('Actualizar mis solicitudes');
  expect(texto()).toContain('CF-DEL-SERVIDOR');
});

test.each([401, 403])('HTTP %s retira el código y el panel de una consulta anterior', async status => {
  perfil = [aprobada];
  await montar();
  consultarAfiliaciones.mockRejectedValueOnce(Object.assign(new Error('no autorizado'), { status }));
  await pulsar('Actualizar mis solicitudes');
  expect(texto()).not.toContain('CF-DEL-SERVIDOR');
  expect(boton('Ganancias')).toBeUndefined();
});

test('fallar la consulta de movimientos no presenta un saldo cero ni elimina un saldo previo', async () => {
  perfil = [aprobada];
  consultarMovimientosComision.mockRejectedValueOnce(new Error('sin conexión'));
  await montar();
  await pulsar('Ganancias');
  expect(texto()).toContain('No pudimos actualizar las comisiones');
  expect(texto()).not.toContain('Saldo de comisiones disponibles: $0');
  await pulsar('Actualizar comisiones de afiliación 82');
  expect(texto()).toContain('Saldo de comisiones disponibles: $850');
  consultarMovimientosComision.mockRejectedValueOnce(new Error('sin conexión'));
  await pulsar('Actualizar comisiones de afiliación 82');
  expect(texto()).toContain('Saldo de comisiones disponibles: $850');
  expect(texto()).toContain('Se conserva la última consulta');
});

test('solicitud con plan obligatorio, bloqueo de doble envío y estado pendiente recibido', async () => {
  const envio = diferida();
  solicitarAfiliacion.mockReturnValue(envio.promise);
  await montar();
  await pulsar('Oportunidades');
  await pulsar('Ver campañas de Norte');
  await pulsar('Solicitar afiliación a Campaña Norte');
  await pulsar('Enviar solicitud de afiliación');
  expect(texto()).toContain('Explica cómo promocionarás');
  expect(solicitarAfiliacion).not.toHaveBeenCalled();
  act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Plan de promoción').props.onChangeText('Compartiré un video'));
  const enviar = boton('Enviar solicitud de afiliación').props.onPress;
  await act(async () => { void enviar(); void enviar(); });
  expect(solicitarAfiliacion).toHaveBeenCalledTimes(1);
  expect(solicitarAfiliacion).toHaveBeenCalledWith(7, 31, 'Compartiré un video', '');
  perfil = [pendiente];
  await act(async () => envio.resolve(pendiente));
  expect(texto()).toContain('Solicitud pendiente');
  expect(boton('Ganancias')).toBeUndefined();
  expect(texto()).not.toContain('CF-DEL-SERVIDOR');
});

test('otra cuenta no recibe respuestas pendientes de la cuenta anterior', async () => {
  const anterior = diferida();
  consultarAfiliaciones.mockReturnValueOnce(anterior.promise);
  await montar();
  perfil = [{ ...aprobada, codigo: 'CF-CUENTA-B' }];
  await act(async () => tree.update(<MisAfiliacionesScreen key="auth-B" nombreUsuario="Cuenta B" onBack={() => {}} />));
  await act(async () => anterior.resolve([{ ...aprobada, codigo: 'CF-CUENTA-A' }]));
  expect(texto()).toContain('CF-CUENTA-B');
  expect(texto()).not.toContain('CF-CUENTA-A');
});
