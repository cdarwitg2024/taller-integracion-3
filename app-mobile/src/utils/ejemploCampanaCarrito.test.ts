import { ejemploCampanaCarrito } from './ejemploCampanaCarrito';

const campana = { tipo: 'carrito_completo', tasa_descuento: 15, tasa_comision: 10 };

test('C01: distingue ahorro, pago del referido y comisión sobre el importe descontado', () => {
  expect(ejemploCampanaCarrito(campana)).toEqual({
    subtotal: 10000, descuento: 1500, subtotalConDescuento: 8500, comision: 850,
  });
});

test('C01: redondea primero el descuento y después la comisión al peso, con mitad hacia arriba', () => {
  expect(ejemploCampanaCarrito(campana, 9990)).toEqual({
    subtotal: 9990, descuento: 1499, subtotalConDescuento: 8491, comision: 849,
  });
});

test('utiliza las tasas de la campaña, incluyendo decimales', () => {
  expect(ejemploCampanaCarrito({ ...campana, tasa_descuento: 12.5, tasa_comision: 7.25 }))
    .toEqual({ subtotal: 10000, descuento: 1250, subtotalConDescuento: 8750, comision: 634 });
});

test('cero es un porcentaje especificado y no un dato faltante', () => {
  expect(ejemploCampanaCarrito({ ...campana, tasa_descuento: 0, tasa_comision: 0 }))
    .toEqual({ subtotal: 10000, descuento: 0, subtotalConDescuento: 10000, comision: 0 });
});

test.each([
  { ...campana, tasa_descuento: null }, { ...campana, tasa_comision: null },
  { ...campana, tipo: 'producto' },
])('no inventa un ejemplo si faltan tasas o corresponde a otro alcance: %j', datos => {
  expect(ejemploCampanaCarrito(datos)).toBeNull();
});
