import { act, Alert, AsyncStorage, CartScreen, tree, transporte, disponibilidad,
  confirmar, agregarOtraCompra, producto, pagarDesdePantalla,
} from '../tests/support/checkoutPrueba';

const registro = '@coffeefast/intento-compra/comprador-app';
const ultimoAviso = () => (Alert.alert as jest.Mock).mock.calls.at(-1);

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
});

test.each(['eliminar', 'disminuir'])('dos toques agrupados para %s vacían y reinician el intento', async modo => {
  const segundo = modo === 'eliminar' ? { ...producto, id: 42, name: 'Alfajor' } : producto;
  await agregarOtraCompra(segundo);
  disponibilidad.mockResolvedValue({ data: [41, 42].map(id => ({ id, cafeteria_id: 7,
    activo: true, eliminado_en: null, stock: 20 })), error: null });
  await act(async () => { await confirmar(); });
  const clave = JSON.parse((await AsyncStorage.getItem(registro))!).clave;
  await act(async () => {
    const props = tree.root.findByType(CartScreen).props;
    if (modo === 'eliminar') { props.onRemove(41); props.onRemove(42); }
    else { props.onDecrease(41); props.onDecrease(41); }
  });
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
  await agregarOtraCompra();
  await agregarOtraCompra(segundo);
  await act(async () => { await confirmar(); });
  expect(transporte.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(clave);
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
  const reiniciar = ultimoAviso()[2].find((accion: { text: string }) => accion.text === 'Reiniciar intento');
  await act(async () => { await reiniciar.onPress(); });
  expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
  expect(transporte).not.toHaveBeenCalled();
  await act(async () => { await confirmar(); });
  expect(transporte).toHaveBeenCalledTimes(1);
});
