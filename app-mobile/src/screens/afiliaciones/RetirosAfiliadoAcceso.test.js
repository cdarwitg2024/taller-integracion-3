import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import RetirosAfiliado from './RetirosAfiliado';
import { supabase } from '../../lib/supabase';

// Conserva el servicio y la renovación reales; sustituye solo la respuesta del SDK.
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
const referencia = 'f876c63c-83b4-4705-9046-c11122223333';
const retiro = { id: 1, monto_clp: 300, creado_en: '2026-11-23T12:00:00Z', referencia };
let tree;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; jest.clearAllMocks(); });

test.each([401, 403, 503])('actualizar con HTTP %s sin error.code aplica la política de acceso al historial cargado', async status => {
  const range = jest.fn().mockResolvedValueOnce({ status: 200, data: [retiro], count: 1, error: null })
    .mockResolvedValueOnce({ status, data: null, count: null, error: { message: 'Rechazo sin código PostgREST' } });
  const query = { select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range };
  supabase.from.mockReturnValue(query);
  await act(async () => { tree = create(<RetirosAfiliado revision={1} />); });
  const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
  const actualizar = () => tree.root.findAllByType(TouchableOpacity)
    .find(n => n.props.accessibilityLabel === 'Actualizar historial de retiros');
  expect(texto()).toContain(referencia); expect(texto()).toContain('-$300 · confirmado');
  await act(async () => actualizar().props.onPress());
  if (status === 503) {
    expect(texto()).toContain('Se conserva la última consulta');
    expect(texto()).toContain(referencia); expect(texto()).toContain('-$300 · confirmado');
    expect(actualizar()).toBeDefined();
  } else {
    expect(texto()).toContain(status === 403 ? 'no tiene permisos' : 'Tu sesión venció');
    expect(texto()).not.toContain(referencia); expect(texto()).not.toContain('-$300');
    expect(texto()).not.toContain('Se conserva la última consulta');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(actualizar()).toBeUndefined();
  }
});
