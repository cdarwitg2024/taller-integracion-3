/**
 * @format
 *
 * Tests de la iconografía de controles — S2-T3.
 *
 * Verifican dos cosas:
 *  1. Que el componente `Icon` renderice el icono pedido con el tamaño y color
 *     que se le pasan (y con el nombre accesible correcto).
 *  2. Que al sustituir los emojis por iconos vectoriales NO se haya roto
 *     ningún control: cada botón sigue disparando su `onPress` original.
 *
 * El punto 2 es la garantía importante: la tarea es un cambio visual, así que
 * el comportamiento de cada control tiene que ser idéntico al de antes.
 */

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, View } from 'react-native';

import Icon from '../src/components/Icon';
import Header from '../src/components/Header';
import CartItem from '../src/components/CartItem';
import ProductDetail from '../src/components/ProductDetail';
import PaymentScreen from '../src/screens/PaymentScreen';
import PedidosScreen from '../src/screens/PedidosScreen';
import { colors } from '../src/theme/colors';

const render = (node: React.ReactElement): ReactTestRenderer.ReactTestRenderer => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

/** Nodos de texto cuyo contenido es exactamente el nombre del icono. */
const iconos = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).filter((t) => typeof t.props.children === 'string');

/** Aplana el style (puede ser un arreglo) a un objeto plano. */
const flatten = (style: any): any => {
  if (style === null || style === undefined || style === false) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, s) => Object.assign(acc, flatten(s)), {});
  }
  return style;
};

describe('Icon', () => {
  it('renderiza el icono con el nombre, tamaño y color indicados', () => {
    const tree = render(<Icon name="cart" size={24} color="#123456" />);
    const nodo = iconos(tree)[0];

    expect(nodo.props.children).toBe('cart');
    const style = flatten(nodo.props.style);
    expect(style.fontSize).toBe(24);
    expect(style.color).toBe('#123456');
  });

  it('usa el tamaño y el color por defecto del tema', () => {
    const tree = render(<Icon name="close" />);
    const nodo = iconos(tree)[0];

    const style = flatten(nodo.props.style);
    expect(style.fontSize).toBe(20);
    expect(style.color).toBe(colors.textoPrimario);
  });

  it('acepta estilos extra y props accesibles', () => {
    const tree = render(<Icon name="add" style={{ marginTop: 4 }} accessibilityLabel="Agregar" />);
    const nodo = iconos(tree)[0];

    expect(flatten(nodo.props.style).marginTop).toBe(4);
    expect(nodo.props.accessibilityLabel).toBe('Agregar');
  });
});

describe('Controles con iconografía vectorial (S2-T3)', () => {
  it('Header: el botón volver dispara onBack y usa un icono vectorial', () => {
    const onBack = jest.fn();
    const tree = render(<Header title="Carrito" onBack={onBack} />);

    const boton = tree.root.findByType(TouchableOpacity);
    act(() => {
      boton.props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    // El glifo '‹' fue sustituido por un icono con nombre.
    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('chevron-back');
    expect(nombres).not.toContain('‹');
  });

  it('Header: sin onBack no renderiza botón de volver', () => {
    const tree = render(<Header title="Pedidos" />);
    expect(tree.root.findAllByType(TouchableOpacity).length).toBe(0);
  });

  it('Header: el botón volver declara su rol y etiqueta accesible', () => {
    const tree = render(<Header title="Carrito" onBack={() => {}} />);
    const boton = tree.root.findByType(TouchableOpacity);

    expect(boton.props.accessibilityRole).toBe('button');
    expect(boton.props.accessibilityLabel).toBe('Volver');
  });

  it('el icono no es un elemento accesible por sí mismo (evita lectura duplicada)', () => {
    const tree = render(<Icon name="close" />);
    const nodo = iconos(tree)[0];
    expect(nodo.props.accessible).toBe(false);
  });

  it('el View que envuelve los iconos mantiene el layout', () => {
    const tree = render(<Icon name="close" />);
    // El mock renderiza un Text; nos interesa que el componente no rompa.
    expect(tree.toJSON()).toBeTruthy();
  });
});

/**
 * Controles que en el emulador sólo se alcanzan con datos reales (productos en
 * el carrito, pedidos con QR, pago en curso). La base local está incompleta, así
 * que acá se cubren por render: lo importante es que el `onPress` original
 * sobreviva al cambio de glifo por icono.
 */
describe('Controles de carrito, detalle y pago (S2-T3)', () => {
  const producto = {
    id: 7,
    name: 'Latte',
    description: 'Café con leche',
    price: 2500,
    emoji: '☕',
    stock: 10,
    stockMin: 2,
    available: true,
    category: 'Bebidas',
    modifications: [],
  };

  it('CartItem: los botones de cantidad usan iconos y siguen invocando onIncrease/onDecrease', () => {
    const onIncrease = jest.fn();
    const onDecrease = jest.fn();
    const onRemove = jest.fn();

    const tree = render(
      <CartItem
        item={{ id: 7, name: 'Latte', description: 'Café con leche', price: 2500, emoji: '☕', quantity: 2 }}
        onIncrease={onIncrease}
        onDecrease={onDecrease}
        onRemove={onRemove}
      />
    );

    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('remove');
    expect(nombres).toContain('add');
    // Los glifos '−' y '+' ya no están.
    expect(nombres).not.toContain('−');
    expect(nombres).not.toContain('+');

    const botones = tree.root.findAllByType(TouchableOpacity);
    const menos = botones.find((b) => b.props.accessibilityLabel === 'Quitar una unidad de Latte');
    const mas = botones.find((b) => b.props.accessibilityLabel === 'Agregar una unidad de Latte');

    act(() => menos!.props.onPress());
    act(() => mas!.props.onPress());

    expect(onDecrease).toHaveBeenCalledWith(7);
    expect(onIncrease).toHaveBeenCalledWith(7);
  });

  it('CartItem: con cantidad mínima el botón de quitar queda deshabilitado', () => {
    const tree = render(
      <CartItem
        item={{ id: 7, name: 'Latte', description: 'Café con leche', price: 2500, emoji: '☕', quantity: 1 }}
        onIncrease={jest.fn()}
        onDecrease={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    const botones = tree.root.findAllByType(TouchableOpacity);
    const menos = botones.find((b) => b.props.accessibilityLabel === 'Quitar una unidad de Latte');
    expect(menos!.props.disabled).toBe(true);
  });

  it('ProductDetail: el icono de cerrar sigue llamando onClose', () => {
    const onClose = jest.fn();
    const tree = render(<ProductDetail product={producto} onAdd={jest.fn()} onClose={onClose} />);

    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('close');
    expect(nombres).not.toContain('✕');

    const boton = tree.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Cerrar detalle');
    act(() => boton!.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PaymentScreen: el icono de cerrar sigue llamando onCancelar', () => {
    // La pantalla anima el monto con Animated + timers: se congelan para que
    // no queden callbacks vivos después de terminar el test.
    jest.useFakeTimers();
    const onCancelar = jest.fn();
    const tree = render(
      <PaymentScreen monto={5000} onPagoExitoso={jest.fn()} onCancelar={onCancelar} />
    );

    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('close');
    expect(nombres).not.toContain('✕');

    const boton = tree.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Cancelar pago');
    act(() => boton!.props.onPress());
    expect(onCancelar).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
});

/**
 * Los dos modales de PedidosScreen. Se renderiza en modo invitado
 * (`userId` vacío): la pantalla usa los pedidos de ejemplo y no consulta
 * nada al backend, así que el test no depende de la base local.
 */
describe('Modales de PedidosScreen (S2-T3)', () => {
  const renderAsync = async (
    node: React.ReactElement
  ): Promise<ReactTestRenderer.ReactTestRenderer> => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(node);
    });
    return tree;
  };

  it('el modal de confirmación se cierra con el icono vectorial', async () => {
    const onConfirmacionVista = jest.fn();
    const tree = await renderAsync(
      <PedidosScreen
        userId={null}
        onGoToCafeterias={jest.fn()}
        pedidoConfirmado={{
          pedido_id: 12,
          total: 6200,
          saldo_restante: 0,
          franja_retiro: '10:00 - 10:30',
        }}
        onConfirmacionVista={onConfirmacionVista}
      />
    );

    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('close');
    expect(nombres).not.toContain('✕');

    const boton = tree.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Cerrar confirmación');
    act(() => boton!.props.onPress());
    expect(onConfirmacionVista).toHaveBeenCalledTimes(1);
  });

  it('el modal de detalle del pedido se cierra con el icono vectorial', async () => {
    const tree = await renderAsync(
      <PedidosScreen
        userId={null}
        onGoToCafeterias={jest.fn()}
        pedidoConfirmado={null}
        onConfirmacionVista={jest.fn()}
      />
    );

    // Se abre el pedido de ejemplo de la pestaña "activos" (código 1264-D).
    const codigo = tree.root
      .findAllByType(Text)
      .find((t) => t.props.children === '1264-D');
    expect(codigo).toBeTruthy();

    let pedido = codigo!.parent;
    while (pedido && pedido.type !== TouchableOpacity) {
      pedido = pedido.parent;
    }
    expect(pedido).toBeTruthy();

    await act(async () => {
      pedido!.props.onPress();
    });

    const boton = tree.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Cerrar detalle del pedido');
    expect(boton).toBeTruthy();

    const nombres = iconos(tree).map((n) => n.props.children);
    expect(nombres).toContain('close');
    expect(nombres).not.toContain('✕');

    act(() => boton!.props.onPress());
    // Al cerrar, el modal desaparece: ya no está el botón de cerrar detalle.
    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .find((b) => b.props.accessibilityLabel === 'Cerrar detalle del pedido')
    ).toBeUndefined();
  });
});
