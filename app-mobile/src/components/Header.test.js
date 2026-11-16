import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import Header from './Header';

test('otros encabezados conservan un botón de regreso con nombre genérico Volver', () => {
  const onBack = jest.fn();
  let tree;
  try {
    act(() => { tree = create(<Header title="Detalle" onBack={onBack} />); });
    const volver = tree.root.findByType(TouchableOpacity);
    expect(volver.props.accessibilityRole).toBe('button');
    expect(volver.props.accessibilityLabel).toBe('Volver');
    act(() => volver.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) act(() => tree.unmount());
  }
});

test('un encabezado sin regreso no expone un botón inactivo a accesibilidad', () => {
  let tree;
  try {
    act(() => { tree = create(<Header title="Mi Perfil" />); });
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  } finally {
    if (tree) act(() => tree.unmount());
  }
});
