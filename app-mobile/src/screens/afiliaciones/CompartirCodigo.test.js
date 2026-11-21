import React from 'react';
import { Share, Text, TouchableOpacity, View } from 'react-native';
import { act, create } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import EstadoAfiliacion from './EstadoAfiliacion';

const norte = { id: 82, cafeteria_id: 7, campana_id: 31, estado: 'aprobada', codigo: 'CF-NORTE-31', codigo_activo: true };
const sur = { id: 91, cafeteria_id: 8, campana_id: 41, estado: 'aprobada', codigo: 'CF-SUR-41', codigo_activo: true };
let tree;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
const boton = label => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === label);
const pulsar = async label => act(async () => boton(label).props.onPress());
const montar = async (solicitud = norte, confirmado = true) => act(async () => {
  tree = create(<EstadoAfiliacion solicitud={solicitud} confirmado={confirmado} />);
});
const diferida = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
beforeEach(() => {
  Clipboard.setStringAsync.mockReset().mockResolvedValue(true);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
});

test('dos campañas: copiar usa exactamente el código visible de la tarjeta seleccionada', async () => {
  await act(async () => { tree = create(<View><EstadoAfiliacion solicitud={norte} /><EstadoAfiliacion solicitud={sur} /></View>); });
  expect(texto()).toContain('Código: CF-NORTE-31');
  expect(texto()).toContain('Código: CF-SUR-41');
  await pulsar('Copiar código de campaña #41, cafetería #8');
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('CF-SUR-41');
  expect(texto()).toContain('Código copiado: CF-SUR-41');
  await pulsar('Copiar código de campaña #31, cafetería #7');
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('CF-NORTE-31');
});

test('compartir entrega al selector el código y el contexto de la campaña elegida', async () => {
  await act(async () => { tree = create(<View><EstadoAfiliacion solicitud={norte} /><EstadoAfiliacion solicitud={sur} /></View>); });
  await pulsar('Compartir código de campaña #41, cafetería #8');
  expect(Share.share).toHaveBeenCalledWith({
    title: 'Código de campaña #41, cafetería #8',
    message: 'Mi código de afiliado CoffeeFast: CF-SUR-41\nCampaña #41 · Cafetería #8\nSujeto a la vigencia de la campaña y al beneficio disponible del comprador.',
  }, { dialogTitle: 'Compartir código de CoffeeFast' });
  expect(Share.share.mock.calls[0][0].message).not.toContain('CF-NORTE-31');
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
});

test('copiar confirma solo al terminar y bloquea el doble toque', async () => {
  const copia = diferida();
  Clipboard.setStringAsync.mockReturnValue(copia.promise);
  await montar();
  const enviar = boton('Copiar código de campaña #31, cafetería #7').props.onPress;
  await act(async () => { void enviar(); void enviar(); });
  expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  expect(texto()).not.toContain('Código copiado:');
  expect(boton('Compartir código de campaña #31, cafetería #7').props.disabled).toBe(true);
  await act(async () => copia.resolve(true));
  expect(texto()).toContain('Código copiado: CF-NORTE-31');
  expect(boton('Compartir código de campaña #31, cafetería #7').props.disabled).toBe(false);
});

test.each([false, 'rechazo'])('si el portapapeles falla (%s), muestra error y permite reintentar', async resultado => {
  if (resultado === false) Clipboard.setStringAsync.mockResolvedValueOnce(false);
  else Clipboard.setStringAsync.mockRejectedValueOnce(new Error('fallo nativo'));
  await montar();
  await pulsar('Copiar código de campaña #31, cafetería #7');
  expect(texto()).toContain('No pudimos copiar el código');
  expect(texto()).not.toContain('Código copiado:');
  await pulsar('Copiar código de campaña #31, cafetería #7');
  expect(texto()).toContain('Código copiado: CF-NORTE-31');
});

test('cerrar el selector no anuncia envío ni error; fallar al abrirlo permite reintentar', async () => {
  Share.share.mockResolvedValueOnce({ action: Share.dismissedAction });
  await montar();
  await pulsar('Compartir código de campaña #31, cafetería #7');
  expect(texto()).not.toContain('No pudimos');
  expect(texto()).not.toContain('enviado');
  Share.share.mockRejectedValueOnce(new Error('no disponible'));
  await pulsar('Compartir código de campaña #31, cafetería #7');
  expect(texto()).toContain('No pudimos abrir el selector');
  await pulsar('Compartir código de campaña #31, cafetería #7');
  expect(texto()).not.toContain('No pudimos abrir el selector');
});

test.each([
  [{ ...norte, estado: 'pendiente' }, true],
  [{ ...norte, estado: 'rechazada' }, true],
  [{ ...norte, codigo_activo: false }, true],
  [norte, false],
])('sin aprobación activa confirmada no ofrece copiar ni compartir: %j', async (solicitud, confirmado) => {
  await montar(solicitud, confirmado);
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
});

test('cambiar de campaña con una copia pendiente no publica la confirmación anterior', async () => {
  const copia = diferida();
  Clipboard.setStringAsync.mockReturnValueOnce(copia.promise);
  await montar();
  await act(async () => { void boton('Copiar código de campaña #31, cafetería #7').props.onPress(); });
  await act(async () => tree.update(<EstadoAfiliacion solicitud={sur} />));
  await act(async () => copia.resolve(true));
  expect(texto()).not.toContain('CF-NORTE-31');
  expect(texto()).not.toContain('Código copiado:');
  await pulsar('Copiar código de campaña #41, cafetería #8');
  expect(texto()).toContain('Código copiado: CF-SUR-41');
});

test('desactivar durante una copia retira las acciones y descarta su confirmación tardía', async () => {
  const copia = diferida();
  Clipboard.setStringAsync.mockReturnValueOnce(copia.promise);
  await montar();
  await act(async () => { void boton('Copiar código de campaña #31, cafetería #7').props.onPress(); });
  await act(async () => tree.update(<EstadoAfiliacion solicitud={{ ...norte, codigo_activo: false }} />));
  await act(async () => copia.resolve(true));
  expect(texto()).toContain('Código desactivado');
  expect(texto()).not.toContain('Código copiado:');
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
});
