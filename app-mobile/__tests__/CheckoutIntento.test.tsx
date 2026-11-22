import { act, Text, randomUUID, CartScreen, tree, transporte, disponibilidad,
  confirmar, retiro, claves, pagarDesdePantalla, agregarOtraCompra, AsyncStorage, Alert,
} from '../tests/support/checkoutPrueba';
test('App bloquea el doble toque antes de otro render y conserva la clave en el reintento', async () => {
  transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
  const checkout = tree.root.findByType(CartScreen).props.onCheckout;
  await act(async () => { await Promise.all([checkout(retiro), checkout(retiro)]); });
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(1);
  await act(async () => { await confirmar(); });
  expect(claves()).toHaveLength(1);
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  const guardado = JSON.parse((await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-app'))!);
  expect(guardado.clave).toBe(claves()[0]);
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)[0]).toBe('No pudimos confirmar tu pago');
});

test('App confirma el pedido y otra compra idéntica recibe una clave nueva', async () => {
  transporte.mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify({ pedido: {
    ok: true, pedido_id: 501, total: 2500, saldo_restante: 7500,
  } }) });
  await pagarDesdePantalla();
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  act(() => jest.advanceTimersByTime(120000));
  await agregarOtraCompra();
  await pagarDesdePantalla();
  expect(claves()[1]).not.toBe(claves()[0]);
  expect(JSON.parse(transporte.mock.calls[1][1].body).franja_retiro).toBe('12:15-12:30');
});

test.each(['respuesta perdida', 'respuesta incompleta'])(
  'pantalla real: %s y cambio de franja conservan el intento sin reenviar el pago', async caso => {
    if (caso === 'respuesta perdida') transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
    await pagarDesdePantalla();
    const original = transporte.mock.calls[0][1];
    expect(JSON.parse(original.body).franja_retiro).toBe('12:00-12:15');
    act(() => jest.advanceTimersByTime(120000));
    expect(tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join(' '))
      .toContain('12:15 - 12:30');
    await pagarDesdePantalla();
    expect(transporte).toHaveBeenCalledTimes(1);
    const guardado = JSON.parse((await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-app'))!);
    expect(guardado.clave).toBe(claves()[0]);
    expect(guardado.firma).toBe(original.body);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

test('un HTTP 400 previo al cobro permite corregir el carrito y confirmar con otra clave', async () => {
  transporte.mockResolvedValueOnce({ ok: false, status: 400,
    text: async () => JSON.stringify({ error: 'Uno o mas productos no pertenecen a la cafeteria indicada' }) });
  await pagarDesdePantalla();
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(1);
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)[0]).toBe('No se pudo procesar el pago');
  await agregarOtraCompra();
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(2);
  expect(claves()[1]).not.toBe(claves()[0]);
  expect(JSON.parse(transporte.mock.calls[1][1].body).items[0].cantidad).toBe(2);
});

test('un fallo de disponibilidad libera el bloqueo para el siguiente intento', async () => {
  disponibilidad.mockResolvedValueOnce({ data: null, error: { message: 'consulta fallida' } });
  await act(async () => { await confirmar(); });
  expect(transporte).not.toHaveBeenCalled();
  await act(async () => { await confirmar(); });
  expect(transporte).toHaveBeenCalledTimes(1);
});
