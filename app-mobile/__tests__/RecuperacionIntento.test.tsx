import { act, Alert, AsyncStorage, CartScreen, tree, transporte, disponibilidad,
  confirmar, agregarOtraCompra, producto, pagarDesdePantalla,
} from '../tests/support/checkoutPrueba';
import { supabase } from '../src/lib/supabase';

const registro = '@coffeefast/intento-compra/comprador-app';
const ultimoAviso = () => (Alert.alert as jest.Mock).mock.calls.at(-1);
const pulsarAviso = (texto: string) =>
  ultimoAviso()[2].find((accion: { text: string }) => accion.text === texto).onPress();

test('401 definitivo permite otra confirmación con sesión recuperada y clave nueva', async () => {
  transporte.mockResolvedValueOnce({ ok: false, status: 401,
    text: async () => JSON.stringify({ error: 'Sesión vencida' }) });
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(1);
  const primero = transporte.mock.calls[0][1];
  expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(1);
  expect(ultimoAviso()[0]).toBe('No se pudo procesar el pago');
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {
    user: { id: 'comprador-app', email: 'comprador@example.test' }, access_token: 'jwt-recuperado',
  } } });
  transporte.mockResolvedValueOnce({ ok: true, status: 201,
    text: async () => JSON.stringify({ pedido: { ok: true, pedido_id: 502,
      total: 2500, saldo_restante: 7500 } }) });
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(2);
  const segundo = transporte.mock.calls[1][1];
  expect(segundo.headers.Authorization).toBe('Bearer jwt-recuperado');
  expect(segundo.headers['Idempotency-Key']).not.toBe(primero.headers['Idempotency-Key']);
  expect(segundo.body).toBe(primero.body);
  expect(disponibilidad).toHaveBeenCalledTimes(2);
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  expect(ultimoAviso()[0]).toBe('Pago aprobado');
});

test('última unidad consumida con respuesta perdida: recuperar no consulta stock ni reenvía el pago', async () => {
  disponibilidad.mockResolvedValueOnce({ data: [{ id: 41, cafeteria_id: 7, activo: true,
    eliminado_en: null, stock: 1 }], error: null });
  transporte.mockRejectedValueOnce(new Error('respuesta perdida después del cobro'));
  await pagarDesdePantalla();
  const original = await AsyncStorage.getItem(registro);
  disponibilidad.mockResolvedValue({ data: [{ id: 41, cafeteria_id: 7, activo: true,
    eliminado_en: null, stock: 0 }], error: null });
  await pagarDesdePantalla();
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(registro)).toBe(original);
  expect(ultimoAviso()[0]).toBe('No pudimos confirmar tu pago');
  expect(ultimoAviso()[2].some((accion: { text: string }) => accion.text === 'Revisar pedidos')).toBe(true);
  await act(async () => { pulsarAviso('Reiniciar intento'); });
  expect(await AsyncStorage.getItem(registro)).toBe(original);
  await act(async () => { await pulsarAviso('Ya revisé, reiniciar'); });
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
  disponibilidad.mockResolvedValue({ data: [{ id: 41, cafeteria_id: 7, activo: true,
    eliminado_en: null, stock: 1 }], error: null });
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(2);
  expect(transporte.mock.calls[1][1].headers['Idempotency-Key'])
    .not.toBe(transporte.mock.calls[0][1].headers['Idempotency-Key']);
});

test.each(['eliminar', 'disminuir'])('dos toques agrupados para %s conservan el intento incierto', async modo => {
  const segundo = modo === 'eliminar' ? { ...producto, id: 42, name: 'Alfajor' } : producto;
  await agregarOtraCompra(segundo);
  disponibilidad.mockResolvedValue({ data: [41, 42].map(id => ({ id, cafeteria_id: 7,
    activo: true, eliminado_en: null, stock: 20 })), error: null });
  transporte.mockRejectedValueOnce(new Error('respuesta perdida después del cobro'));
  await act(async () => { await confirmar(); });
  const intentoOriginal = await AsyncStorage.getItem(registro);
  await act(async () => {
    const props = tree.root.findByType(CartScreen).props;
    if (modo === 'eliminar') { props.onRemove(41); props.onRemove(42); }
    else { props.onDecrease(41); props.onDecrease(41); }
  });
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  expect(await AsyncStorage.getItem(registro)).toBe(intentoOriginal);
  await agregarOtraCompra();
  await agregarOtraCompra(segundo);
  await act(async () => { await confirmar(); });
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(registro)).toBe(intentoOriginal);
  expect(ultimoAviso()[0]).toBe('No pudimos confirmar tu pago');
});

test('si falla el marcador tras un pago confirmado, no limpia ni anuncia éxito y bloquea otro POST', async () => {
  transporte.mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify({ pedido: {
    ok: true, pedido_id: 501, total: 2500, saldo_restante: 7500,
  } }) });
  const guardar = AsyncStorage.setItem as jest.Mock;
  const original = guardar.getMockImplementation()!;
  guardar.mockImplementation(async (clave, valor) => {
    if (JSON.parse(valor).invalidado) throw new Error('almacenamiento sin espacio');
    return original(clave, valor);
  });
  try {
    await act(async () => { await confirmar(); });
    expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(1);
    expect(ultimoAviso()[0]).toBe('Revisar intento de compra');
    expect((Alert.alert as jest.Mock).mock.calls.some(([titulo]) => titulo === 'Pago aprobado')).toBe(false);
    await act(async () => { await confirmar(); });
    expect(transporte).toHaveBeenCalledTimes(1);
  } finally { guardar.mockImplementation(original); }
});

test('un registro dañado muestra diagnóstico y permite reiniciar explícitamente sin enviar un pago', async () => {
  await AsyncStorage.setItem(registro, '{dañado');
  await act(async () => { await confirmar(); });
  expect(transporte).not.toHaveBeenCalled();
  expect(ultimoAviso()[1]).toContain('No se pudo recuperar el intento local');
  await act(async () => {
    pulsarAviso('Reiniciar intento');
    await pulsarAviso('Ya revisé, reiniciar');
  });
  expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
  expect(transporte).not.toHaveBeenCalled();
  await act(async () => { await confirmar(); });
  expect(transporte).toHaveBeenCalledTimes(1);
});
