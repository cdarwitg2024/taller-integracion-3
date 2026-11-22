import React from 'react';
import { ActivityIndicator, AppState, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import MisAfiliacionesScreen from '../MisAfiliacionesScreen';
import { consultarAfiliaciones, solicitarAfiliacion, consultarMovimientosComision } from '../../services/afiliaciones';
import { listarCampanasActivas } from '../../services/campanasAfiliados';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
jest.mock('../../services/saldoAfiliado', () => ({ consultarSaldoAfiliado: jest.fn() }));

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
  consultarSaldoAfiliado.mockResolvedValue({ pendiente_clp: 0, disponible_clp: 850, retirado_clp: 0 });
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
  expect(texto()).toContain('Saldo disponible para retirar: $850');
  await pulsar('Historial');
  expect(texto()).toContain('Comisión · Pedido #501');
  expect(texto()).toContain('$850 · disponible');
});

test('con dos afiliaciones muestra un solo saldo global y no suma los movimientos por campaña', async () => {
  perfil = [aprobada, { ...aprobada, id: 83, cafeteria_id: 8, campana_id: 41, codigo: 'CF-SUR' }];
  consultarSaldoAfiliado.mockResolvedValue({ pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 });
  await montar();
  await pulsar('Ganancias');
  expect(tree.root.findAllByType(Text).filter(n => String(n.props.children).startsWith('Saldo disponible para retirar:'))).toHaveLength(1);
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  expect(consultarMovimientosComision).not.toHaveBeenCalled();
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
  expect(texto()).toContain('Saldo disponible para retirar: $850');
  await pulsar('Mis códigos');
  expect(texto()).toContain('Código desactivado: ya no se puede usar');
  expect(texto()).toContain('CF-DEL-SERVIDOR');
  await pulsar('Historial');
  expect(texto()).toContain('Comisión · Pedido #501');
  expect(texto()).toContain('Saldo disponible para retirar: $850');
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

test('403 del perfil explica los permisos, retira el panel y no invita a reintentar el formulario', async () => {
  perfil = [aprobada];
  await montar();
  consultarAfiliaciones.mockRejectedValue(Object.assign(new Error('prohibido'), { status: 403 }));
  await pulsar('Actualizar mis solicitudes');
  expect(texto()).toContain('Tu cuenta no tiene permisos para consultar afiliaciones');
  expect(texto()).not.toContain('CF-DEL-SERVIDOR');
  expect(boton('Ganancias')).toBeUndefined();
  expect(boton('Actualizar mis solicitudes')).toBeUndefined();
  await pulsar('Oportunidades');
  await pulsar('Ver campañas de Norte');
  expect(texto()).toContain('Tu cuenta no tiene permisos para solicitar afiliación');
  expect(texto()).not.toContain('Actualiza tus solicitudes para poder solicitar');
  expect(texto()).not.toContain('Intenta nuevamente');
  expect(boton('Solicitar afiliación a Campaña Norte')).toBeUndefined();
  expect(boton('Enviar solicitud de afiliación')).toBeUndefined();
  expect(solicitarAfiliacion).not.toHaveBeenCalled();
});

test('fallar la consulta de movimientos no presenta un saldo cero ni elimina un saldo previo', async () => {
  perfil = [aprobada];
  consultarMovimientosComision.mockRejectedValueOnce(new Error('sin conexión'));
  await montar();
  await pulsar('Historial');
  expect(texto()).toContain('No pudimos actualizar las comisiones');
  expect(texto()).not.toContain('Saldo disponible para retirar: $0');
  await pulsar('Actualizar comisiones de afiliación 82');
  expect(texto()).toContain('Saldo disponible para retirar: $850');
  consultarMovimientosComision.mockRejectedValueOnce(new Error('sin conexión'));
  await pulsar('Actualizar comisiones de afiliación 82');
  expect(texto()).toContain('Saldo disponible para retirar: $850');
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
  expect(tree.root.findAllByType(ActivityIndicator).some(n => n.props.accessibilityLabel === 'Enviando solicitud de afiliación')).toBe(true);
  expect(texto()).toContain('Campaña Norte');
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

test('carga inicial y lista vacía son estados distintos y no envían solicitudes', async () => {
  const carga = diferida();
  consultarAfiliaciones.mockReturnValueOnce(carga.promise);
  await montar();
  expect(texto()).toContain('Actualizando el estado de tus solicitudes');
  expect(texto()).not.toContain('Todavía no tienes solicitudes');
  await act(async () => carga.resolve([]));
  expect(texto()).toContain('Todavía no tienes solicitudes de afiliación');
  expect(texto()).not.toContain('No pudimos actualizar');
  expect(boton('Oportunidades')).toBeDefined();
  expect(solicitarAfiliacion).not.toHaveBeenCalled();
});

test.each([0, 503])('fallo de solicitud HTTP %s conserva campañas y campos; el reintento usa el mismo alcance', async status => {
  solicitarAfiliacion.mockRejectedValueOnce(Object.assign(new Error('fallo controlado'), { status }))
    .mockResolvedValueOnce(pendiente);
  await montar();
  await pulsar('Oportunidades');
  await pulsar('Ver campañas de Norte');
  await pulsar('Solicitar afiliación a Campaña Norte');
  act(() => {
    tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Plan de promoción').props.onChangeText('Video para Norte');
    tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Enlace público opcional').props.onChangeText('https://example.test/norte');
  });
  await pulsar('Enviar solicitud de afiliación');
  expect(texto()).toContain('No pudimos confirmar el envío');
  expect(texto()).toContain('Campaña Norte');
  expect(tree.root.findAllByType(TextInput).map(n => n.props.value)).toEqual(['Video para Norte', 'https://example.test/norte']);
  expect(listarCampanasActivas).toHaveBeenCalledTimes(1);
  expect(solicitarAfiliacion).toHaveBeenCalledTimes(1);
  perfil = [pendiente];
  await pulsar('Reintentar solicitud de afiliación');
  expect(solicitarAfiliacion.mock.calls).toEqual([
    [7, 31, 'Video para Norte', 'https://example.test/norte'],
    [7, 31, 'Video para Norte', 'https://example.test/norte'],
  ]);
  expect(texto()).toContain('Solicitud pendiente');
  expect(texto()).toContain('Campaña Norte');
  expect(listarCampanasActivas).toHaveBeenCalledTimes(1);
});

test('si falla la consulta posterior al alta, actualizar solo consulta y no repite el POST', async () => {
  solicitarAfiliacion.mockResolvedValueOnce(pendiente);
  await montar();
  await pulsar('Oportunidades');
  await pulsar('Ver campañas de Norte');
  await pulsar('Solicitar afiliación a Campaña Norte');
  act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Plan de promoción').props.onChangeText('Video para Norte'));
  consultarAfiliaciones.mockRejectedValueOnce(Object.assign(new Error('sin red'), { status: 0 }));
  await pulsar('Enviar solicitud de afiliación');
  expect(texto()).toContain('No pudimos actualizar tus solicitudes');
  expect(texto()).toContain('Se conserva la última consulta');
  expect(texto()).toContain('Solicitud pendiente');
  expect(texto()).toContain('Campaña Norte');
  expect(solicitarAfiliacion).toHaveBeenCalledTimes(1);
  perfil = [pendiente];
  const consultas = consultarAfiliaciones.mock.calls.length;
  await pulsar('Actualizar mis solicitudes');
  expect(consultarAfiliaciones).toHaveBeenCalledTimes(consultas + 1);
  expect(solicitarAfiliacion).toHaveBeenCalledTimes(1);
  expect(listarCampanasActivas).toHaveBeenCalledTimes(1);
  expect(texto()).not.toContain('No pudimos actualizar tus solicitudes');
});

test.each([401, 403])('un HTTP %s al enviar no ofrece reintentar el alta con permisos inválidos', async status => {
  solicitarAfiliacion.mockRejectedValueOnce(Object.assign(new Error('no autorizado'), { status }));
  await montar();
  await pulsar('Oportunidades');
  await pulsar('Ver campañas de Norte');
  await pulsar('Solicitar afiliación a Campaña Norte');
  act(() => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === 'Plan de promoción').props.onChangeText('Video para Norte'));
  await pulsar('Enviar solicitud de afiliación');
  expect(texto()).toContain(status === 401 ? 'Tu sesión venció' : 'Tu cuenta no tiene permiso');
  expect(texto()).toContain('Campaña Norte');
  expect(boton('Enviar solicitud de afiliación')).toBeUndefined();
  expect(boton('Reintentar solicitud de afiliación')).toBeUndefined();
  expect(solicitarAfiliacion).toHaveBeenCalledTimes(1);
});
