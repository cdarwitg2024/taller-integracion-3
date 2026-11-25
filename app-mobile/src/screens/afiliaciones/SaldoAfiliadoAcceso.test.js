import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import SaldoAfiliado from './SaldoAfiliado';
import ComisionesAfiliado from './ComisionesAfiliado';
import { supabase } from '../../lib/supabase';
jest.mock('../../lib/supabase', () => ({ supabase: {
  rpc: jest.fn(), from: jest.fn(), auth: { getSession: jest.fn(), refreshSession: jest.fn() },
} }));
let tree;
const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
beforeEach(() => { supabase.rpc.mockReset().mockResolvedValue({ data: [{ pendiente_clp: 500, disponible_clp: 700, retirado_clp: 300 }], error: null, status: 200 }); });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
test.each([401, 403, 503])('SDK con HTTP %s sin error.code conserva solo el saldo autorizado', async status => {
  await act(async () => { tree = create(<SaldoAfiliado />); });
  expect(texto()).toContain('Saldo disponible para retirar: $700');
  supabase.rpc.mockResolvedValueOnce({ data: null, status, error: { message: 'Rechazo del servidor sin código PostgREST' } });
  await act(async () => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === 'Actualizar saldo de comisiones').props.onPress());
  if (status === 503) {
    expect(texto()).toContain('Saldo disponible para retirar: $700'); expect(texto()).toContain('Se conserva la última consulta');
  } else {
    expect(texto()).not.toContain('Saldo disponible para retirar:');
    expect(texto()).not.toContain('Se conserva la última consulta');
    expect(texto()).toContain(status === 403 ? 'no tiene permisos' : 'sesión venció');
  }
});
test.each([401, 403, 503])('comisiones con HTTP %s sin error.code no retienen filas sin autorización', async status => {
  const range = jest.fn().mockResolvedValue({ data: [{ id: 1, afiliacion_id: 82, pedido_id: 501, tipo: 'comision',
    estado: 'disponible', monto_clp: 500, creado_en: '2026-11-24T12:00:00Z' }], count: 1, error: null, status: 200 });
  const consulta = { select: () => consulta, eq: () => consulta, order: () => consulta, range };
  supabase.from.mockReturnValue(consulta);
  await act(async () => { tree = create(<ComisionesAfiliado afiliacion={{ id: 82, cafeteria_id: 7, campana_id: 31, codigo_activo: true }} historial />); });
  expect(texto()).toContain('$500 · disponible');
  range.mockResolvedValueOnce({ data: null, status, error: { message: 'Rechazo sin código PostgREST' } });
  await act(async () => tree.root.findByType(TouchableOpacity).props.onPress());
  if (status === 503) {
    expect(texto()).toContain('$500 · disponible'); expect(texto()).toContain('Se conserva la última consulta');
  } else {
    expect(texto()).not.toContain('$500 · disponible');
    expect(texto()).not.toContain('Se conserva la última consulta');
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  }
});
