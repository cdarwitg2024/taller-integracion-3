import { aplicarCambioProducto, productoPorId } from './productos';

const producto = (over = {}) => ({
  id: 1,
  cafeteriaId: 7,
  name: 'Café latte',
  price: 1500,
  stock: 5,
  available: true,
  ...over,
});

describe('aplicarCambioProducto (Realtime de productos)', () => {
  test('desactivar saca el producto del menú', () => {
    const { productos } = aplicarCambioProducto([producto()], {
      id: 1,
      stock: 5,
      activo: false,
    });
    expect(productos).toHaveLength(0);
  });

  test('eliminado_en también lo saca del menú', () => {
    const { productos } = aplicarCambioProducto([producto()], {
      id: 1,
      stock: 5,
      activo: true,
      eliminadoEn: '2026-10-31T12:00:00Z',
    });
    expect(productos).toHaveLength(0);
  });

  test('reactivar un producto que no estaba pide recargar la lista', () => {
    const { productos, recargar } = aplicarCambioProducto([], {
      id: 1,
      stock: 5,
      activo: true,
    });
    expect(recargar).toBe(true);
    expect(productos).toHaveLength(0);
  });

  test('stock 0 lo deja sin disponibilidad', () => {
    const { productos } = aplicarCambioProducto([producto()], {
      id: 1,
      stock: 0,
      activo: true,
    });
    expect(productos[0].available).toBe(false);
  });

  test('un cambio de precio se refleja sin recargar', () => {
    const { productos, recargar } = aplicarCambioProducto([producto()], {
      id: 1,
      stock: 5,
      activo: true,
      precio: 1900,
    });
    expect(productos[0].price).toBe(1900);
    expect(recargar).toBe(false);
  });

  test('el detalle abierto sigue la lista viva y se cierra si el producto sale', () => {
    const lista = [producto()];
    expect(productoPorId(lista, 1).price).toBe(1500);

    const { productos } = aplicarCambioProducto(lista, {
      id: 1,
      stock: 5,
      activo: false,
    });
    expect(productoPorId(productos, 1)).toBeNull();
  });
});
