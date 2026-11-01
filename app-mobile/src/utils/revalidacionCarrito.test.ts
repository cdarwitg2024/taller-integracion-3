import { evaluarDisponibilidad, mensajeProblemas } from './revalidacionCarrito';

const carrito = [
  { id: 1, name: 'Café latte', quantity: 2 },
  { id: 2, name: 'Sándwich', quantity: 1 },
];

// Carrito de un solo ítem: aísla el caso de stock sin que el otro producto
// cuente como faltante.
const unItem = [{ id: 1, name: 'Café latte', quantity: 2 }];

const producto = (over = {}) => ({
  id: 1,
  cafeteria_id: 7,
  nombre: 'Café latte',
  activo: true,
  eliminado_en: null,
  stock: 10,
  ...over,
});

describe('evaluarDisponibilidad', () => {
  test('con todo disponible no hay problemas', () => {
    expect(
      evaluarDisponibilidad(carrito, [producto(), producto({ id: 2, nombre: 'Sándwich' })], 7)
    ).toEqual([]);
  });

  test('un producto que no viene en el resultado se trata como desactivado (RLS/borrado)', () => {
    // RLS puede filtrar la fila: el carrito lo tenía, la consulta no lo devuelve.
    const problemas = evaluarDisponibilidad(carrito, [producto()], 7);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({
      tipo: 'desactivado',
      nombre: 'Sándwich',
      solicitado: 1,
    });
  });

  test('un producto de otra cafetería no se puede pagar', () => {
    const problemas = evaluarDisponibilidad(unItem, [producto({ cafeteria_id: 9 })], 7);
    expect(problemas[0].tipo).toBe('desactivado');
  });

  test('un producto inactivo o eliminado bloquea el pago', () => {
    expect(evaluarDisponibilidad(unItem, [producto({ activo: false })], 7)[0].tipo).toBe(
      'desactivado'
    );
    expect(
      evaluarDisponibilidad(unItem, [producto({ eliminado_en: '2026-10-31T12:00:00Z' })], 7)[0]
        .tipo
    ).toBe('desactivado');
  });

  test('stock insuficiente se informa con stock y cantidad solicitada', () => {
    const problemas = evaluarDisponibilidad(unItem, [producto({ stock: 1 })], 7);
    expect(problemas).toEqual([
      { tipo: 'sin_stock', nombre: 'Café latte', solicitado: 2, stock: 1 },
    ]);
  });

  test('stock igual a lo solicitado alcanza', () => {
    expect(evaluarDisponibilidad(unItem, [producto({ stock: 2 })], 7)).toEqual([]);
  });

  test('un carrito vacío no tiene problemas', () => {
    expect(evaluarDisponibilidad([], [], 7)).toEqual([]);
  });
});

describe('mensajeProblemas', () => {
  test('agrupa desactivados y sin stock en un solo mensaje', () => {
    const mensaje = mensajeProblemas([
      { tipo: 'desactivado', nombre: 'Café latte', solicitado: 2 },
      { tipo: 'sin_stock', nombre: 'Sándwich', solicitado: 3, stock: 1 },
    ]);
    expect(mensaje).toContain('Producto(s) desactivado(s) o no disponible(s):');
    expect(mensaje).toContain('• Café latte');
    expect(mensaje).toContain('• Sándwich (solicitado: 3, stock: 1)');
    expect(mensaje).toContain('El carrito no fue modificado');
  });

  test('trunca la lista larga sin perder el total', () => {
    const problemas = Array.from({ length: 8 }, (_, i) => ({
      tipo: 'desactivado' as const,
      nombre: `Producto ${i}`,
      solicitado: 1,
    }));
    const mensaje = mensajeProblemas(problemas);
    expect(mensaje).toContain('• Producto 5');
    expect(mensaje).not.toContain('• Producto 6');
    expect(mensaje).toContain('• ... y 2 más');
  });
});
