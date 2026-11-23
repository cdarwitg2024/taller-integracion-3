import { act, Alert, AsyncStorage, Text, cotizar, disponibilidad, pagarDesdePantalla,
  pestaña, responderNuevoTotal, transporte, tree } from '../tests/support/checkoutPrueba';
import PedidosScreen from '../src/screens/PedidosScreen';
import { supabase } from '../src/lib/supabase';
import * as intentos from '../src/services/intentoCompra';

const respuesta = (body: object) => ({ ok: true, status: 201, text: async () => JSON.stringify(body) });

test.each([
  ['stock_insuficiente', 409, 'Stock insuficiente', false],
  ['stock_insuficiente', 409, 'Stock insuficiente', true],
  ['sin_wallet', 422, 'Wallet no disponible', false],
  ['sin_wallet', 422, 'Wallet no disponible', true],
])('un %s (%s, %s) conserva el carrito y cierra el intento (recuperación: %s)',
  async (error, status, titulo, recuperar) => {
    cotizar.mockResolvedValue(respuesta({ subtotal: 2500, descuento_afiliado: 0, total: 2500 }));
    await pestaña('Cafeterías');
    await pestaña('Carrito');
    if (recuperar) transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
    transporte.mockResolvedValueOnce({
      ok: false, status, text: async () => JSON.stringify({ error, cobrado: false }),
    });

    await pagarDesdePantalla();
    const claveOriginal = transporte.mock.calls[0][1].headers['Idempotency-Key'];
    if (recuperar) {
      const accion = (Alert.alert as jest.Mock).mock.calls.at(-1)[2]
        .find((opcion: { text: string }) => opcion.text === 'Recuperar compra');
      await act(async () => { await accion.onPress(); });
      expect(transporte.mock.calls[1][1]).toEqual(expect.objectContaining({
        body: transporte.mock.calls[0][1].body,
        headers: expect.objectContaining({ 'Idempotency-Key': claveOriginal }),
      }));
    }

    const registro = await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-app');
    expect(JSON.parse(registro!).invalidado).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(titulo, expect.stringContaining('No se realizó el cobro'));
    await pagarDesdePantalla();
    const [, nuevoPost] = transporte.mock.calls.at(-1)!;
    expect(nuevoPost.body).toBe(transporte.mock.calls[0][1].body);
    expect(nuevoPost.headers['Idempotency-Key']).not.toBe(claveOriginal);
  },
);

test.each([false, true])('Pedidos muestra el ID recuperado incluso si falla la limpieza (%s)', async fallaLimpieza => {
  cotizar.mockResolvedValueOnce(respuesta({ subtotal: 2500, descuento_afiliado: 0, total: 2500 }));
  await pestaña('Cafeterías');
  await pestaña('Carrito');

  const pedidos = new Map<string, { cuerpo: string; pedido: object }>();
  let saldo = 10000;
  transporte.mockImplementation(async (_url, { body, headers }) => {
    const clave = headers['Idempotency-Key'];
    const existente = pedidos.get(clave);
    if (existente) {
      expect(body).toBe(existente.cuerpo);
      return respuesta(existente.pedido);
    }
    saldo -= JSON.parse(body).total_aceptado;
    pedidos.set(clave, { cuerpo: body, pedido: {
      pedido_id: 501, estado: 'pagado', total_pagado: 2500, descuento_afiliado: 0,
    } });
    throw new Error('Conexión interrumpida después de confirmar');
  });

  await pagarDesdePantalla();
  expect(pedidos.size).toBe(1);
  expect(saldo).toBe(7500);
  const acciones = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  const recuperar = acciones.find((accion: { text: string }) => accion.text === 'Recuperar compra');
  expect(recuperar).toBeDefined();
  const desde = supabase.from as jest.Mock;
  desde.mockImplementation(() => ({ select: () => ({
    eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
  }) }));
  if (fallaLimpieza) {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disco no disponible'));
  }
  await act(async () => { await recuperar.onPress(); });
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  expect(transporte).toHaveBeenCalledTimes(2);
  expect(pedidos.size).toBe(1);
  expect(saldo).toBe(7500);
  expect(tree.root.findByType(PedidosScreen).props.pedidoConfirmado.pedido_id).toBe(501);
  expect(tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join('')).toContain('#501');
  const guardado = await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-app');
  if (fallaLimpieza) {
    expect(JSON.parse(guardado!).pendiente).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith('Pago confirmado', expect.stringContaining('No se pudo limpiar'));
  } else {
    expect(JSON.parse(guardado!).invalidado).toBe(true);
  }
});

test('si falla el diagnóstico después de perder la respuesta, ofrece revisar Pedidos sin rechazar el manejador', async () => {
  jest.spyOn(intentos, 'leerCompraCotizadaPendiente').mockRejectedValueOnce(new Error('fallo inesperado'));
  transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
  await expect(pagarDesdePantalla()).resolves.toBeUndefined();
  expect(Alert.alert).toHaveBeenCalledWith('No pudimos confirmar tu pago',
    expect.stringContaining('No se pudo consultar el intento guardado'),
    expect.arrayContaining([expect.objectContaining({ text: 'Revisar pedidos' })]));
  expect(transporte).toHaveBeenCalledTimes(1);
});

test.each(['sin cobro', 'sin confirmación de cobro', 'saldo sin cobro', 'saldo incierto', 'red'])(
  'recuperación con %s decide si puede recotizar y renovar la clave', async escenario => {
    const cotizacion = (total: number) => respuesta({ subtotal: total, descuento_afiliado: 0, total });
    cotizar.mockResolvedValueOnce(cotizacion(2500)).mockResolvedValueOnce(cotizacion(3000));
    await pestaña('Cafeterías');
    await pestaña('Carrito');
    transporte.mockRejectedValueOnce(new Error('respuesta perdida'));
    if (escenario === 'red') transporte.mockRejectedValueOnce(new Error('sin conexión'));
    else transporte.mockResolvedValueOnce({
      ok: false, status: escenario.startsWith('saldo') ? 422 : 409, text: async () => JSON.stringify({
        error: escenario.startsWith('saldo') ? 'saldo_insuficiente' : 'precio_actualizado', total_actualizado: 3000,
        cobrado: escenario.endsWith('sin cobro') ? false : undefined,
      }),
    });
    await pagarDesdePantalla();
    const registro = '@coffeefast/intento-compra/comprador-app';
    const original = await AsyncStorage.getItem(registro);
    const recuperar = (Alert.alert as jest.Mock).mock.calls.at(-1)[2]
      .find((accion: { text: string }) => accion.text === 'Recuperar compra');
    await act(async () => { await recuperar.onPress(); });
    expect(transporte).toHaveBeenCalledTimes(2);
    const [, originalPost] = transporte.mock.calls[0];
    expect(transporte.mock.calls[1][1].body).toBe(originalPost.body);
    expect(transporte.mock.calls[1][1].headers['Idempotency-Key']).toBe(originalPost.headers['Idempotency-Key']);
    if (escenario !== 'sin cobro' && escenario !== 'saldo sin cobro') {
      expect(await AsyncStorage.getItem(registro)).toBe(original);
      expect(cotizar).toHaveBeenCalledTimes(2);
      return;
    }
    expect(JSON.parse((await AsyncStorage.getItem(registro))!).invalidado).toBe(true);
    const total = escenario === 'saldo sin cobro' ? 2500 : 3000;
    if (escenario === 'saldo sin cobro') {
      expect(Alert.alert).toHaveBeenCalledWith('Saldo insuficiente en la Wallet',
        expect.stringContaining('No se realizó el cobro'));
      expect(cotizar).toHaveBeenCalledTimes(2);
    }
    expect(tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join(''))
      .toContain(`$${total.toLocaleString('es-CL')}`);
    await pagarDesdePantalla(escenario !== 'sin cobro');
    if (escenario === 'sin cobro') await responderNuevoTotal('Aceptar y pagar');
    expect(transporte).toHaveBeenCalledTimes(3);
    const [, nuevoPost] = transporte.mock.calls[2];
    expect(JSON.parse(nuevoPost.body).total_aceptado).toBe(total);
    expect(nuevoPost.headers['Idempotency-Key']).not.toBe(originalPost.headers['Idempotency-Key']);
  },
);
