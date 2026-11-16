import React from 'react';
import { BackHandler, Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import PerfilScreen from './PerfilScreen';
import MisAfiliacionesScreen from './MisAfiliacionesScreen';
import Header from '../components/Header';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() },
}));

const session = { user: { id: 'auth-estudiante-a01', email: 'estudiante.a01@example.test' } };
let tree;
let perfil;

beforeEach(() => {
  perfil = {
    id: 901, auth_user_id: session.user.id, email: session.user.email,
    nombre: 'Estudiante', apellido: 'A01', rol_id: 1, roles: { nombre: 'estudiante' },
  };
  supabase.from.mockImplementation(tabla => {
    const consulta = {
      select: jest.fn(() => consulta), or: jest.fn(() => consulta),
      eq: jest.fn(() => consulta), order: jest.fn(() => consulta),
      maybeSingle: jest.fn(async () => ({ data: tabla === 'usuarios' ? perfil : null, error: null })),
      limit: jest.fn(async () => ({ data: [], error: null })),
    };
    return consulta;
  });
  supabase.channel.mockImplementation(() => {
    const canal = { on: jest.fn(() => canal), subscribe: jest.fn(() => canal) };
    return canal;
  });
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function montar(props = {}) {
  await act(async () => {
    tree = create(<PerfilScreen session={session} isGuest={false} {...props} />);
  });
}

const acceso = () => tree.root.findAllByType(TouchableOpacity)
  .find(nodo => nodo.props.accessibilityLabel === 'Mis afiliaciones');
const titulo = () => tree.root.findByType(Header).props.title;
const abrir = async () => act(async () => acceso().props.onPress());

test('A01: perfil de estudiante → Mis afiliaciones → perfil conserva la sesión y los datos', async () => {
  await montar();
  expect(titulo()).toBe('Mi Perfil');
  expect(acceso()).toBeDefined();
  await abrir();
  expect(titulo()).toBe('Mis afiliaciones');
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(1);
  const consultasAntesDeVolver = supabase.from.mock.calls.length;
  await act(async () => tree.root.findAllByType(Button)
    .find(nodo => nodo.props.title === 'Volver al perfil').props.onPress());
  expect(titulo()).toBe('Mi Perfil');
  expect(acceso()).toBeDefined();
  expect(tree.root.findAllByType(Text).some(nodo => nodo.props.children === 'Estudiante A01')).toBe(true);
  expect(supabase.from.mock.calls.length).toBe(consultasAntesDeVolver);
});

test('la flecha se identifica como botón Volver al perfil y regresa al perfil', async () => {
  await montar();
  await abrir();
  const volver = tree.root.findByType(Header).findByType(TouchableOpacity);
  expect(volver.props.accessibilityRole).toBe('button');
  expect(volver.props.accessibilityLabel).toBe('Volver al perfil');
  await act(async () => volver.props.onPress());
  expect(titulo()).toBe('Mi Perfil');
});

test('Atrás de Android vuelve al perfil y retira su manejador al salir', async () => {
  const remove = jest.fn();
  const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  await montar();
  await abrir();
  const handler = add.mock.calls.find(([evento]) => evento === 'hardwareBackPress')[1];
  act(() => { expect(handler()).toBe(true); });
  expect(titulo()).toBe('Mi Perfil');
  expect(remove).toHaveBeenCalled();
});

test('el invitado no tiene acceso a Mis afiliaciones', async () => {
  await montar({ session: null, isGuest: true });
  expect(acceso()).toBeUndefined();
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(0);
});

test.each([
  [2, 'empleado'], [3, 'dueño'],
])('el rol %s (%s) no muestra el acceso de estudiante', async (rol_id, nombre) => {
  perfil = { ...perfil, rol_id, roles: { nombre } };
  await montar();
  expect(acceso()).toBeUndefined();
});

test('un perfil sin vínculo Auth no habilita el acceso', async () => {
  perfil = { ...perfil, auth_user_id: null };
  await montar();
  expect(acceso()).toBeUndefined();
});

test('al cerrar la sesión se deja de mostrar la sección abierta', async () => {
  await montar();
  await abrir();
  await act(async () => tree.update(<PerfilScreen session={null} isGuest />));
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(0);
  expect(acceso()).toBeUndefined();
});

test('al cambiar de cuenta no se conserva la sección abierta del estudiante anterior', async () => {
  await montar();
  await abrir();
  const otraSesion = { user: { id: 'auth-estudiante-b01', email: 'otro.a01@example.test' } };
  perfil = { ...perfil, id: 902, auth_user_id: otraSesion.user.id, email: otraSesion.user.email };
  await act(async () => tree.update(<PerfilScreen session={otraSesion} isGuest={false} />));
  expect(titulo()).toBe('Mi Perfil');
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(0);
});
