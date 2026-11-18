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

const abrirVista = async nombre => act(async () => tree.root.findAllByType(TouchableOpacity)
  .find(nodo => nodo.props.accessibilityLabel === nombre).props.onPress());
const textoVisible = () => tree.root.findAllByType(Text)
  .flatMap(nodo => nodo.props.children).filter(texto => typeof texto === 'string').join(' ');

test.each([
  ['Oportunidades', 'Campañas de cafeterías'],
  ['Mis códigos', 'Tus códigos de afiliado'],
  ['Ganancias', 'Comisiones por entregas'],
])(
  'A02: abre %s desde una sola entrada y vuelve a Mis afiliaciones y al perfil', async (nombre, contenido) => {
    await montar();
    await abrir();
    await abrirVista(nombre);
    expect(titulo()).toBe(nombre);
    expect(textoVisible()).toContain('Cuenta activa: Estudiante');
    expect(textoVisible()).toContain(contenido);
    expect(textoVisible()).toContain('estará disponible próximamente');
    const header = tree.root.findByType(Header);
    expect(header.findByType(TouchableOpacity).props.accessibilityLabel).toBe('Volver a Mis afiliaciones');
    await act(async () => header.findByType(TouchableOpacity).props.onPress());
    expect(titulo()).toBe('Mis afiliaciones');
    await act(async () => tree.root.findAllByType(Button)
      .find(nodo => nodo.props.title === 'Volver al perfil').props.onPress());
    expect(titulo()).toBe('Mi Perfil');
    expect(tree.root.findByType(PerfilScreen).props.session).toBe(session);
  }
);

test('A02: cambia entre las tres vistas con pestañas sin perder la cuenta ni recargar el perfil', async () => {
  await montar();
  const consultasIniciales = supabase.from.mock.calls.length;
  await abrir();
  await abrirVista('Oportunidades');
  for (const nombre of ['Mis códigos', 'Ganancias', 'Oportunidades']) {
    await abrirVista(nombre);
    expect(titulo()).toBe(nombre);
    const tabs = tree.root.findAllByType(TouchableOpacity).filter(nodo => nodo.props.accessibilityRole === 'tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.filter(nodo => nodo.props.accessibilityState.selected)
      .map(nodo => nodo.props.accessibilityLabel)).toEqual([nombre]);
    expect(tree.root.findByType(PerfilScreen).props.session).toBe(session);
    expect(textoVisible()).toContain('Cuenta activa: Estudiante');
  }
  expect(supabase.from.mock.calls.length).toBe(consultasIniciales);
});

test('A02: Atrás de Android retrocede de Ganancias a Mis afiliaciones y luego al perfil', async () => {
  const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  await montar();
  await abrir();
  await abrirVista('Ganancias');
  act(() => { expect(add.mock.calls.at(-1)[1]()).toBe(true); });
  expect(titulo()).toBe('Mis afiliaciones');
  act(() => { expect(add.mock.calls.at(-1)[1]()).toBe(true); });
  expect(titulo()).toBe('Mi Perfil');
});

test('A02: el botón inferior de una vista devuelve al menú de afiliaciones', async () => {
  await montar();
  await abrir();
  await abrirVista('Mis códigos');
  await act(async () => tree.root.findAllByType(Button)
    .find(nodo => nodo.props.title === 'Volver a Mis afiliaciones').props.onPress());
  expect(titulo()).toBe('Mis afiliaciones');
});

test('A02: cerrar sesión desde una vista impide conservar contenido de la cuenta anterior', async () => {
  await montar();
  await abrir();
  await abrirVista('Ganancias');
  await act(async () => tree.update(<PerfilScreen session={null} isGuest />));
  expect(tree.root.findAllByType(MisAfiliacionesScreen)).toHaveLength(0);
  expect(textoVisible()).not.toContain('Cuenta activa: Estudiante');
});

test('A02: una cuenta nueva empieza en el perfil y abre el menú inicial, sin la vista anterior', async () => {
  await montar();
  await abrir();
  await abrirVista('Mis códigos');
  const otraSesion = { user: { id: 'auth-estudiante-a02', email: 'otro.a02@example.test' } };
  perfil = { ...perfil, id: 903, nombre: 'Otra cuenta', auth_user_id: otraSesion.user.id, email: otraSesion.user.email };
  await act(async () => tree.update(<PerfilScreen session={otraSesion} isGuest={false} />));
  expect(titulo()).toBe('Mi Perfil');
  await abrir();
  expect(titulo()).toBe('Mis afiliaciones');
  expect(textoVisible()).toContain('Cuenta activa: Otra cuenta');
  expect(textoVisible()).not.toContain('Cuenta activa: Estudiante');
});
