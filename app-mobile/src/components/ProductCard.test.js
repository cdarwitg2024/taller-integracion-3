import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

import ProductCard from './ProductCard';

const producto = (over = {}) => ({
  id: 1,
  cafeteriaId: 7,
  name: 'Café latte',
  description: 'Café con leche',
  price: 1500,
  stock: 5,
  stockMin: 1,
  available: true,
  iconName: 'coffee',
  ...over,
});

const montar = (props = {}) => {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <ProductCard product={producto()} onAdd={() => {}} onPress={() => {}} {...props} />
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

const botonAgregar = (tree) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => String(n.props.accessibilityLabel || '').includes('al carrito') ||
      String(n.props.accessibilityLabel || '').includes('no disponible'));

describe('ProductCard', () => {
  test('un producto disponible se puede agregar', () => {
    const onAdd = jest.fn();
    const tree = montar({ onAdd });
    const boton = botonAgregar(tree);
    expect(boton.props.disabled).toBe(false);
    act(() => boton.props.onPress());
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  test('un producto sin disponibilidad no se puede agregar', () => {
    const onAdd = jest.fn();
    const tree = montar({
      onAdd,
      product: producto({ available: false, stock: 0 }),
    });
    const boton = botonAgregar(tree);
    expect(boton.props.disabled).toBe(true);
    expect(textos(tree)).toContain('No disponible');
    act(() => boton.props.onPress());
    expect(onAdd).not.toHaveBeenCalled();
  });
});
