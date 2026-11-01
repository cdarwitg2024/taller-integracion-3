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

// Junta el texto de todos los <Text>: los children pueden venir en array.
const textos = (tree) =>
  tree.root
    .findAllByType(Text)
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join('')
        : String(n.props.children)
    )
    .join(' | ');

// Sube desde el <Text> hasta el nodo que tiene onPress (chip de franja).
const presionable = (tree, etiqueta) => {
  const nodo = tree.root
    .findAllByType(Text)
    .find((n) => String(n.props.children) === etiqueta);
  let actual = nodo;
  while (actual && typeof actual.props?.onPress !== 'function') {
    actual = actual.parent;
  }
  return actual;
};

const botonPagar = (tree) => tree.root.findAllByType(Button)[0];

describe('CartScreen', () => {
  test('muestra ítems, total y cantidad del carrito', () => {
    const plano = textos(montar());
    expect(plano).toContain('Café latte');
    expect(plano).toContain('Sándwich');
    // 2 x 2000 + 3500
    expect(plano).toContain(`$${(7500).toLocaleString('es-CL')}`);
    expect(plano).toContain('3 productos');
  });

  test('sin franja seleccionada el pago está bloqueado', () => {
    expect(botonPagar(montar()).props.disabled).toBe(true);
  });

  test('con franja elegida, pagar envía una sola solicitud', () => {
    const onCheckout = jest.fn();
    const tree = montar({ onCheckout });

    act(() => presionable(tree, '12:00 - 12:15').props.onPress());
    expect(botonPagar(tree).props.disabled).toBe(false);

    act(() => botonPagar(tree).props.onPress());
    expect(onCheckout).toHaveBeenCalledTimes(1);
    expect(onCheckout).toHaveBeenCalledWith({ franja: '12:00-12:15' });
  });

  test('mientras se paga el botón queda bloqueado y en carga', () => {
    const tree = montar({ paying: true });
    const boton = botonPagar(tree);
    expect(boton.props.disabled).toBe(true);
    expect(boton.props.loading).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });
});
