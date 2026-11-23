import { act, Alert, AsyncStorage, Text, cotizar, disponibilidad, pagarDesdePantalla,
  pestaña, transporte, tree } from '../tests/support/checkoutPrueba';
import PedidosScreen from '../src/screens/PedidosScreen';
import { supabase } from '../src/lib/supabase';

const respuesta = (body: object) => ({ ok: true, status: 201, text: async () => JSON.stringify(body) });

test('el servidor cobra, se pierde la respuesta y Pedidos muestra el mismo ID al recuperar', async () => {
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
  await act(async () => { await recuperar.onPress(); });
  expect(disponibilidad).toHaveBeenCalledTimes(1);
  expect(transporte).toHaveBeenCalledTimes(2);
  expect(pedidos.size).toBe(1);
  expect(saldo).toBe(7500);
  expect(tree.root.findByType(PedidosScreen).props.pedidoConfirmado.pedido_id).toBe(501);
  expect(tree.root.findAllByType(Text).flatMap(nodo => nodo.props.children).join('')).toContain('#501');
  const guardado = await AsyncStorage.getItem('@coffeefast/intento-compra/comprador-app');
  expect(JSON.parse(guardado!).invalidado).toBe(true);
});
