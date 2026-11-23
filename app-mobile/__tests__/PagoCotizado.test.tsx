import Input from '../src/components/Input';
import Button from '../src/components/Button';
import CartItem from '../src/components/CartItem';
import { TouchableOpacity } from 'react-native';
import { act, Alert, CartScreen, cotizar, disponibilidad, pagarDesdePantalla, pestaña, producto,
  reiniciarApp, responderNuevoTotal, Text, transporte, tree } from '../tests/support/checkoutPrueba';
import { supabase } from '../src/lib/supabase';

const json = (status: number, body: object) => ({
  ok: status < 300, status, text: async () => JSON.stringify(body),
});
const cotizacion = (subtotal: number, descuento_afiliado = 0) =>
  json(200, { subtotal, descuento_afiliado, total: subtotal - descuento_afiliado });
const pulsar = (title: string) => act(async () =>
  tree.root.findAllByType(Button).find(n => n.props.title === title)!.props.onPress());
const textos = () => tree.root.findAllByType(Text).map(n => [].concat(n.props.children).join('')).join(' | ');
const importe = (total: number) => `$${total.toLocaleString('es-CL')}`;

test('dos cambios rápidos conservan la última cotización y el pago usa sus cantidades e importe', async () => {
  let responderDos!: (valor: ReturnType<typeof cotizacion>) => void;
  let responderTres!: typeof responderDos;
  cotizar.mockResolvedValueOnce(cotizacion(5000))
    .mockImplementationOnce(() => new Promise(resolve => { responderDos = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { responderTres = resolve; }));
  await pestaña('Cafeterías');
  await pestaña('Carrito');
  const aumentar = () => act(async () => tree.root.findByType(CartItem).props.onIncrease(producto.id));
  await aumentar();
  await aumentar();
  expect(cotizar.mock.calls.slice(-2).map(([, opciones]) => JSON.parse(opciones.body).items[0].cantidad))
    .toEqual([2, 3]);
  expect(textos()).not.toContain(importe(5000));
  await pagarDesdePantalla();
  expect(transporte).not.toHaveBeenCalled();

  await act(async () => responderTres(cotizacion(15000)));
  await act(async () => responderDos(cotizacion(10000)));
  expect(textos()).toContain(importe(15000));
  expect(textos()).not.toContain(importe(10000));

  let terminarStock!: () => void;
  disponibilidad.mockImplementationOnce(() => new Promise(resolve => {
    terminarStock = () => resolve({ error: null, data: [{ id: producto.id,
      cafeteria_id: 7, activo: true, eliminado_en: null, stock: 20 }] });
  }));
  await act(async () => {
    void tree.root.findAllByType(Button).find(n => n.props.title === 'Proceder al Pago')!.props.onPress();
  });
  expect(tree.root.findByType(CartItem).props.disabled).toBe(true);
  await aumentar();
  expect(cotizar).toHaveBeenCalledTimes(4);
  transporte.mockResolvedValueOnce(json(201, {
    pedido_id: 503, estado: 'pagado', total_pagado: 15000, descuento_afiliado: 0,
  }));
  await act(async () => terminarStock());
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(JSON.parse(transporte.mock.calls[0][1].body)).toMatchObject({
    items: [{ producto_id: producto.id, cantidad: 3 }], total_aceptado: 15000,
  });
});

test.each([false, true])('D13: compra sin atribución y consulta en Pedidos (quitó código: %s)', async quitarCodigo => {
  const idPedido = quitarCodigo ? 502 : 501;
  cotizar.mockResolvedValueOnce(cotizacion(quitarCodigo ? 10000 : 11000));
  if (quitarCodigo) cotizar.mockResolvedValueOnce(cotizacion(10000, 1500)).mockResolvedValueOnce(cotizacion(11000));
  await pestaña('Cafeterías');
  await pestaña('Carrito');
  if (quitarCodigo) {
    await act(async () => tree.root.findByType(Input).props.onChangeText('NORTE'));
    await pulsar('Aplicar');
    expect(textos()).toContain(importe(8500));
    await pulsar('Quitar');
  }
  expect(textos()).toContain(importe(11000));
  transporte.mockResolvedValueOnce(json(201, {
    pedido_id: idPedido, estado: 'pagado', total_pagado: 11000, descuento_afiliado: 0,
  }));
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(1);
  const [url, opciones] = transporte.mock.calls[0];
  expect(url).toContain('/api/pedidos');
  expect(JSON.parse(opciones.body)).toEqual({
    cafeteria_id: 7, items: [{ producto_id: producto.id, cantidad: 1 }],
    franja_retiro: '12:00-12:15', total_aceptado: 11000,
  });
  expect(opciones.headers['Idempotency-Key']).toBeTruthy();
  expect(tree.root.findByType(CartScreen).props.cart).toHaveLength(0);
  expect(Alert.alert).toHaveBeenCalledWith('Pago aprobado', `Total pagado: ${importe(11000)}.`);
  const fila = { id: idPedido, estado: 'pendiente', total: 11000,
    codigo_pedido: `D13-${idPedido}`, creado_en: '2026-11-23T12:00:00Z',
    detalles_pedido: [{ cantidad: 1, subtotal: 11000, precio_unitario: 11000 }] };
  const canal = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };
  Object.assign(supabase, { channel: () => canal, removeChannel: jest.fn() });
  (supabase.from as jest.Mock).mockImplementation(() => {
    const consulta = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: { id: 17 }, error: null }),
      order: async () => ({ data: [fila], error: null }) };
    return consulta;
  });
  await pestaña('Pedidos');
  await pulsar('Ver mis pedidos');
  await act(async () => tree.root.findAllByType(TouchableOpacity)
    .find(n => n.props.accessibilityLabel?.startsWith('Ver pedido '))!.props.onPress());
  expect(textos()).toContain(`D13-${idPedido}`);
  expect(textos()).toContain(`Total cobrado | ${importe(11000)}`);
  expect(textos()).toContain(`Descuento aplicado | ${importe(0)}`);
});

test('si falla la cotización tras editar la cantidad, el pago no vuelve al flujo sin cotización', async () => {
  cotizar.mockResolvedValueOnce(cotizacion(5000))
    .mockResolvedValueOnce(json(503, { error: 'No se pudo cotizar' }));
  await pestaña('Cafeterías');
  await pestaña('Carrito');
  await act(async () => tree.root.findByType(CartItem).props.onIncrease(producto.id));
  expect(textos()).toContain('No se pudo obtener la cotización.');
  await pagarDesdePantalla();
  expect(transporte).not.toHaveBeenCalled();
});

test.each([[false, false], [true, false], [false, true]])(
  'un 409 exige confirmar de nuevo (fallo de cotización: %s, reinicio: %s)', async (falla, reiniciar) => {
  cotizar.mockResolvedValueOnce(cotizacion(11000));
  if (falla) cotizar.mockResolvedValueOnce(json(503, { error: 'No se pudo cotizar' }));
  cotizar.mockResolvedValueOnce(cotizacion(12000));
  await pestaña('Cafeterías');
  await pestaña('Carrito');
  transporte.mockResolvedValueOnce(json(409, {
    error: 'precio_actualizado', total_actualizado: 12000, cobrado: false,
  }));
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Cambió el total', expect.stringContaining('No se realizó el cobro'));
  if (falla) {
    const pagar = tree.root.findAllByType(Button).find(n => n.props.title === 'Proceder al Pago')!;
    expect(pagar.props.disabled).toBe(true);
    await pagarDesdePantalla();
    expect(transporte).toHaveBeenCalledTimes(1);
    await pulsar('Reintentar cotización');
    expect(transporte).toHaveBeenCalledTimes(1);
  }
  expect(textos()).toContain(importe(12000));
  if (reiniciar) {
    cotizar.mockResolvedValueOnce(cotizacion(12000));
    await reiniciarApp();
    expect(textos()).toContain(importe(12000));
  }
  await pagarDesdePantalla(false);
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(await responderNuevoTotal('Rechazar')).toContain(importe(12000));
  expect(transporte).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(CartScreen).props.cart).toEqual([producto]);
  await pagarDesdePantalla(false);
  expect(await responderNuevoTotal('Aceptar y pagar')).toContain(importe(12000));
  expect(transporte).toHaveBeenCalledTimes(2);
  const [primero, segundo] = transporte.mock.calls.map(([, opciones]) => opciones);
  expect(JSON.parse(segundo.body).total_aceptado).toBe(12000);
  expect(segundo.headers['Idempotency-Key']).not.toBe(primero.headers['Idempotency-Key']);
});
