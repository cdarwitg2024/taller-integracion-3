import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Text } from 'react-native';

import CartScreen from './CartScreen';
import Button from '../components/Button';

const cart = [
  { id: 1, name: 'Café latte', price: 2000, quantity: 2, cafeteriaId: 7 },
  { id: 2, name: 'Sándwich', price: 3500, quantity: 1, cafeteriaId: 7 },
];

const montar = (props = {}) => {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <CartScreen
        cart={cart}
        cafeteriaName="Cafetería Test"
        onIncrease={() => {}}
        onDecrease={() => {}}
        onRemove={() => {}}
        onCheckout={() => {}}
        onBack={() => {}}
        {...props}
      />
    );
  });
  return tree;
};

const textos = (tree) =>
  tree.root
    .findAllByType(Text)
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join('')
        : String(n.props.children)
    )
    .join(' | ');

const chip = (tree, etiqueta) => {
  const texto = tree.root
    .findAllByType(Text)
    .find((n) => String(n.props.children) === etiqueta);
  let actual = texto;
  while (actual && typeof actual.props.onPress !== 'function') {
    actual = actual.parent;
  }
  return actual;
};

const botonPagar = (tree) => tree.root.findAllByType(Button)[0];

// Reloj fijo: las franjas son 12:00-13:30, así que sin esto el resultado
// dependería de la hora real en que corre el test.
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 0, 15, 12, 14, 0));
  // CartScreen usa el `alert` global de React Native; en Jest no existe.
  global.alert = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CartScreen - franjas de retiro', () => {
  test('una franja vencida queda deshabilitada', () => {
    jest.setSystemTime(new Date(2026, 0, 15, 12, 20, 0));
    const tree = montar();
    expect(chip(tree, '12:00 - 12:15').props.disabled).toBe(true);
    expect(chip(tree, '12:15 - 12:30').props.disabled).toBe(false);
  });

  test('si la franja elegida vence, la selección deja de ser válida', () => {
    const tree = montar();
    act(() => chip(tree, '12:00 - 12:15').props.onPress());
    expect(botonPagar(tree).props.disabled).toBe(false);

    // 12:14:00 -> 12:15:01: la franja venció con la pantalla abierta
    act(() => {
      jest.advanceTimersByTime(61000);
    });

    expect(chip(tree, '12:00 - 12:15').props.disabled).toBe(true);
    expect(botonPagar(tree).props.disabled).toBe(true);
  });

  test('sin franjas disponibles muestra el mensaje y bloquea el pago', () => {
    jest.setSystemTime(new Date(2026, 0, 15, 14, 0, 0));
    const tree = montar();
    expect(textos(tree)).toContain('No hay franjas de retiro disponibles');
    expect(botonPagar(tree).props.disabled).toBe(true);
  });

  test('el checkout revalida con referencia fresca, no con el último tick', () => {
    const onCheckout = jest.fn();
    const tree = montar({ onCheckout });
    act(() => chip(tree, '12:00 - 12:15').props.onPress());

    // La franja vence, pero el intervalo todavía no corrió.
    jest.setSystemTime(new Date(2026, 0, 15, 12, 15, 30));
    act(() => botonPagar(tree).props.onPress());

    expect(onCheckout).not.toHaveBeenCalled();
    expect(botonPagar(tree).props.disabled).toBe(true);
  });
});

describe('CartScreen - carrito y pago', () => {
  test('muestra ítems, total y cantidad del carrito', () => {
    const plano = textos(montar());
    expect(plano).toContain('Café latte');
    expect(plano).toContain('Sándwich');
    expect(plano).toContain(`$${(7500).toLocaleString('es-CL')}`);
    expect(plano).toContain('3 productos');
  });

  test('mientras se paga el botón queda bloqueado y en carga', () => {
    const tree = montar({ paying: true });
    const boton = botonPagar(tree);
    expect(boton.props.disabled).toBe(true);
    expect(boton.props.loading).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  test('con franja vigente, pagar envía una sola solicitud', () => {
    const onCheckout = jest.fn();
    const tree = montar({ onCheckout });
    act(() => chip(tree, '12:00 - 12:15').props.onPress());
    act(() => botonPagar(tree).props.onPress());
    expect(onCheckout).toHaveBeenCalledTimes(1);
    expect(onCheckout).toHaveBeenCalledWith({ franja: '12:00-12:15' });
  });
});
