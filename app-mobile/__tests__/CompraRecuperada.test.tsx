import { act, Alert, AsyncStorage, Text, cotizar, disponibilidad, pagarDesdePantalla,
  pestaña, transporte, tree } from '../tests/support/checkoutPrueba';
import PedidosScreen from '../src/screens/PedidosScreen';
import { supabase } from '../src/lib/supabase';
import * as intentos from '../src/services/intentoCompra';

const respuesta = (body: object) => ({ ok: true, status: 201, text: async () => JSON.stringify(body) });

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
