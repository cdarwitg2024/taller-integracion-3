import Input from '../src/components/Input';
import Button from '../src/components/Button';
import { act, Alert, CartScreen, cotizar, pagarDesdePantalla, pestaña, producto,
  Text, transporte, tree } from '../tests/support/checkoutPrueba';

const json = (status: number, body: object) => ({
  ok: status < 300, status, text: async () => JSON.stringify(body),
});
const cotizacion = (subtotal: number, descuento_afiliado = 0) =>
  json(200, { subtotal, descuento_afiliado, total: subtotal - descuento_afiliado });
const pulsar = (title: string) => act(async () =>
  tree.root.findAllByType(Button).find(n => n.props.title === title)!.props.onPress());
const textos = () => tree.root.findAllByType(Text).map(n => [].concat(n.props.children).join('')).join(' | ');
const importe = (total: number) => `$${total.toLocaleString('es-CL')}`;

test('tras quitar el código, el toque de pago acepta el total cotizado aunque el precio local sea distinto', async () => {
  cotizar.mockResolvedValueOnce(cotizacion(10000))
    .mockResolvedValueOnce(cotizacion(10000, 1500)).mockResolvedValueOnce(cotizacion(11000));
  await pestaña('Cafeterías');
  await pestaña('Carrito');
  await act(async () => tree.root.findByType(Input).props.onChangeText('NORTE'));
  await pulsar('Aplicar');
  expect(textos()).toContain(importe(8500));
  await pulsar('Quitar');
  expect(textos()).toContain(importe(11000));
  transporte.mockResolvedValueOnce(json(201, {
    pedido_id: 501, estado: 'pagado', total_pagado: 11000, descuento_afiliado: 0,
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
});

test.each([false, true])('un 409 exige una cotización válida antes de confirmar (fallo inicial: %s)', async falla => {
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
  await pagarDesdePantalla();
  expect(transporte).toHaveBeenCalledTimes(2);
  const [primero, segundo] = transporte.mock.calls.map(([, opciones]) => opciones);
  expect(JSON.parse(segundo.body).total_aceptado).toBe(12000);
  expect(segundo.headers['Idempotency-Key']).not.toBe(primero.headers['Idempotency-Key']);
});
