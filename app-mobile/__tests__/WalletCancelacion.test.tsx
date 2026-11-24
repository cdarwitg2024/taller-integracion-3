import { act, Alert, Text, pestaña, transporte, tree } from '../tests/support/checkoutPrueba';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Button from '../src/components/Button';
import { supabase } from '../src/lib/supabase';

test.each([[true, false], [false, false], [true, true]])(
  'Wallet conserva el saldo confirmado (éxito: %s, lectura pendiente: %s)', async (exito, pendiente) => {
  const pedido = { id: 52, estado: 'pendiente', total: 5100, codigo_pedido: 'REAL-52',
    creado_en: '2026-11-20T12:00:00Z', cafeterias: { nombre: 'Norte' },
    detalles_pedido: [{ cantidad: 3, subtotal: 6000, precio_unitario: 2000 }] };
  let walletDisponible = true;
  const canal = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };
  Object.assign(supabase, { channel: jest.fn(() => canal), removeChannel: jest.fn() });
  (supabase.from as jest.Mock).mockImplementation(tabla => {
    const consulta = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: { id: 17 }, error: null }),
      single: async () => walletDisponible
        ? { data: { id: 9, usuario_id: 17, saldo_actual: 4900 }, error: null }
        : pendiente ? new Promise(() => {}) : { data: null, error: new Error('Lectura interrumpida') },
      limit: async () => ({ data: [], error: null }),
      then: (resolver: (resultado: object) => void) =>
        resolver({ data: tabla === 'pedidos' ? [pedido] : [], error: null }),
    };
    return consulta;
  });
  const saldoVisible = (saldo: number) => expect(tree.root.findAllByType(Text)
    .some(n => n.props.children === `$${saldo.toLocaleString('es-CL')}`)).toBe(true);
  await pestaña('Wallet');
  saldoVisible(4900);
  await pestaña('Pedidos');
  await act(async () => tree.root.findAllByType(TouchableOpacity)
    .find(n => n.props.accessibilityLabel?.startsWith('Ver pedido '))!.props.onPress());
  await act(async () => tree.root.findAllByType(Button)
    .find(n => n.props.title === 'Cancelar pedido y reembolsar')!.props.onPress());
  transporte.mockResolvedValueOnce({ ok: exito, status: exito ? 200 : 409,
    text: async () => JSON.stringify(exito
      ? { ok: true, pedido_id: 52, monto_reembolsado: 5100, saldo_nuevo: 10000 }
      : { error: 'no_cancelable' }) });
  const confirmar = (Alert.alert as jest.Mock).mock.calls.at(-1)[2]
    .find((opcion: { style: string }) => opcion.style === 'destructive');
  await act(async () => { await confirmar.onPress(); });
  expect(transporte).toHaveBeenCalledTimes(1);
  walletDisponible = false;
  await pestaña('Wallet');
  saldoVisible(exito ? 10000 : 4900);
  if (pendiente) {
    act(() => jest.advanceTimersByTime(3000));
    let nodo = tree.root.findAllByType(Text).find(n => n.props.children === `$${(10000).toLocaleString('es-CL')}`);
    expect(nodo).toBeDefined();
    const opacidades = [];
    while (nodo) {
      const opacidad = StyleSheet.flatten(nodo.props.style as any)?.opacity;
      if (opacidad !== undefined) opacidades.push(opacidad);
      nodo = nodo.parent ?? undefined;
    }
    expect(opacidades.length).toBeGreaterThanOrEqual(2);
    expect(opacidades.every(opacidad => opacidad === 1)).toBe(true);
  }
});
