/**
 * @format
 *
 * Tests del design system de CoffeeFast (S2-T1).
 *
 * Verifican que los componentes reutilizables se rendericen, expongan las
 * props correctas y — lo importante — que normalicen color/tipografía a los
 * tokens del tema sin perder comportamiento previo (incluye las dos regresiones
 * que se arreglaron: `variant="outline"` sin estilos en Button y `autoCorrect`
 * ignorado en Input).
 */

// react-test-renderer con React 18 exige marcar el entorno de act().
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  View,
} from 'react-native';

import Button from '../src/components/Button';
import Card from '../src/components/Card';
import Input from '../src/components/Input';
import Title from '../src/components/Title';
import Container from '../src/components/Container';

import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

/** Aplana el style (arreglos anidados) a un único objeto plano. */
const flatten = (style: any): any => {
  if (style === null || style === undefined || style === false) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, s) => Object.assign(acc, flatten(s)), {});
  }
  return style;
};

const render = (node: React.ReactElement): ReactTestRenderer.ReactTestRenderer => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

const findAllText = (tree: ReactTestRenderer.ReactTestRenderer, value: string) =>
  tree.root.findAllByType(Text).filter((t) => t.props.children === value);

describe('Button', () => {
  it('renderiza el título y dispara onPress', () => {
    const onPress = jest.fn();
    const tree = render(<Button title="Iniciar sesión" onPress={onPress} />);

    expect(findAllText(tree, 'Iniciar sesión').length).toBeGreaterThan(0);

    const touchable = tree.root.findByType(TouchableOpacity);
    act(() => {
      touchable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('está deshabilitado y no expone el press cuando lo está', () => {
    const tree = render(<Button title="Guardar" onPress={() => {}} disabled />);
    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
    expect(touchable.props.accessibilityState.disabled).toBe(true);
  });

  it('en loading muestra spinner y bloquea el botón', () => {
    const tree = render(<Button title="Pagar" onPress={() => {}} loading />);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(true);
  });

  it('soporta variant outline (regresión: no existía)', () => {
    const tree = render(<Button title="Cancelar" variant="outline" onPress={() => {}} />);
    const style = flatten(tree.root.findByType(TouchableOpacity).props.style);

    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.cafeOscuro);

    const label = findAllText(tree, 'Cancelar')[0];
    expect(flatten(label.props.style).color).toBe(colors.cafeOscuro);
  });

  it('usa el color de texto esperado en cada variante', () => {
    const esperado = {
      primary: colors.textoBlanco,
      secondary: colors.textoPrimario,
      outline: colors.cafeOscuro,
      ghost: colors.textoPrimario,
      danger: colors.textoBlanco,
    } as const;

    (Object.keys(esperado) as Array<keyof typeof esperado>).forEach((variant) => {
      const tree = render(<Button title="X" variant={variant} onPress={() => {}} />);
      const label = findAllText(tree, 'X')[0];
      expect(flatten(label.props.style).color).toBe(esperado[variant]);
    });
  });

  it('aplica el radio del tema y crece a fullWidth', () => {
    const tree = render(<Button title="X" onPress={() => {}} fullWidth />);
    const style = flatten(tree.root.findByType(TouchableOpacity).props.style);
    expect(style.borderRadius).toBe(radius.md);
    expect(style.width).toBe('100%');
  });
});

describe('Card', () => {
  it('renderiza sus hijos', () => {
    const tree = render(
      <Card>
        <Text>Hola tarjeta</Text>
      </Card>,
    );
    expect(findAllText(tree, 'Hola tarjeta').length).toBe(1);
  });

  it('usa fondo blanco y radio del tema', () => {
    const tree = render(<Card />);
    const style = flatten(tree.root.findByType(View).props.style);
    expect(style.backgroundColor).toBe(colors.blanco);
    expect(style.borderRadius).toBe(radius.lg);
    expect(style.borderWidth).toBe(1);
  });

  it('permite pasar padding y estilo extra', () => {
    const tree = render(<Card padding="lg" style={{ marginTop: 40 }} />);
    const style = flatten(tree.root.findByType(View).props.style);
    expect(style.padding).toBe(16);
    expect(style.marginTop).toBe(40);
  });
});

describe('Input', () => {
  it('renderiza label, placeholder y propaga onChange', () => {
    const onChangeText = jest.fn();
    const tree = render(
      <Input label="Correo" placeholder="tunombre@alu.uct.cl" value="" onChangeText={onChangeText} />,
    );

    expect(findAllText(tree, 'Correo').length).toBe(1);
    const input = tree.root.findByType(TextInput);
    expect(input.props.placeholder).toBe('tunombre@alu.uct.cl');
    act(() => {
      input.props.onChangeText('a@b.cl');
    });
    expect(onChangeText).toHaveBeenCalledWith('a@b.cl');
  });

  it('propaga autoCorrect al TextInput (regresión: se ignoraba)', () => {
    const tree = render(<Input value="" onChangeText={() => {}} autoCorrect={false} />);
    expect(tree.root.findByType(TextInput).props.autoCorrect).toBe(false);
  });

  it('conserva los defaults previos (autoCapitalize none / autoCorrect true)', () => {
    const tree = render(<Input value="" onChangeText={() => {}} />);
    const input = tree.root.findByType(TextInput);
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(true);
  });

  it('pinta el borde de error y muestra el mensaje', () => {
    const tree = render(<Input value="" onChangeText={() => {}} error="Campo obligatorio" />);
    expect(findAllText(tree, 'Campo obligatorio').length).toBe(1);
    const style = flatten(tree.root.findByType(TextInput).props.style);
    expect(style.borderColor).toBe(colors.rojo);
  });

  it('permite pasar props de TextInput (secureTextEntry, maxLength, returnKeyType)', () => {
    const onSubmit = jest.fn();
    const tree = render(
      <Input
        value=""
        onChangeText={() => {}}
        secureTextEntry
        maxLength={10}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />,
    );
    const input = tree.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.maxLength).toBe(10);
    expect(input.props.returnKeyType).toBe('done');
    expect(input.props.onSubmitEditing).toBe(onSubmit);
  });
});

describe('Title', () => {
  it('renderiza título y subtítulo', () => {
    const tree = render(
      <Title title="¿Olvidaste tu contraseña?" subtitle="Te enviaremos un código" />,
    );
    expect(findAllText(tree, '¿Olvidaste tu contraseña?').length).toBe(1);
    expect(findAllText(tree, 'Te enviaremos un código').length).toBe(1);
  });

  it('aplica el tamaño y peso de cada variante', () => {
    const esperado = { display: 32, h1: typography.tituloGrande, h2: 22, h3: typography.titulo };
    (Object.keys(esperado) as Array<keyof typeof esperado>).forEach((variant) => {
      const tree = render(<Title title="T" variant={variant} />);
      const style = flatten(findAllText(tree, 'T')[0].props.style);
      expect(style.fontSize).toBe(esperado[variant]);
    });
  });

  it('usa la fuente serif del tema cuando serif está activo', () => {
    const tree = render(<Title title="Iniciar Sesión" serif />);
    const style = flatten(findAllText(tree, 'Iniciar Sesión')[0].props.style);
    expect(style.fontFamily).toBe(typography.familiaTitulo);
  });

  it('no aplica familia serif cuando serif={false}', () => {
    const tree = render(<Title title="Ingresa tu código" serif={false} />);
    const style = flatten(findAllText(tree, 'Ingresa tu código')[0].props.style);
    expect(style.fontFamily).toBeUndefined();
    expect(style.textAlign).toBe('left');
  });

  it('respeta align="center"', () => {
    const tree = render(<Title title="T" subtitle="S" align="center" />);
    const title = flatten(findAllText(tree, 'T')[0].props.style);
    const sub = flatten(findAllText(tree, 'S')[0].props.style);
    expect(title.textAlign).toBe('center');
    expect(sub.textAlign).toBe('center');
  });

  it('acepta overrides puntuales titleStyle/subtitleStyle', () => {
    const tree = render(
      <Title title="T" subtitle="S" titleStyle={{ marginBottom: 8 }} subtitleStyle={{ fontSize: 13 }} />,
    );
    expect(flatten(findAllText(tree, 'T')[0].props.style).marginBottom).toBe(8);
    expect(flatten(findAllText(tree, 'S')[0].props.style).fontSize).toBe(13);
  });
});

describe('Container', () => {
  it('renderiza sus hijos sin scroll ni teclado por defecto', () => {
    const tree = render(
      <Container>
        <Text>Contenido</Text>
      </Container>,
    );
    expect(findAllText(tree, 'Contenido').length).toBe(1);
    expect(tree.root.findAllByType(ScrollView).length).toBe(0);
  });

  it('envuelve en ScrollView cuando scroll está activo', () => {
    const tree = render(
      <Container scroll>
        <Text>Contenido</Text>
      </Container>,
    );
    expect(tree.root.findAllByType(ScrollView).length).toBe(1);
  });

  it('aplica el contenido con padding cuando se pide', () => {
    const tree = render(
      <Container scroll padding="xl">
        <Text>Contenido</Text>
      </Container>,
    );
    const content = flatten(tree.root.findByType(ScrollView).props.contentContainerStyle);
    expect(content.paddingHorizontal).toBe(20);
    expect(content.paddingVertical).toBe(20);
  });

  it('respeta el background por defecto del tema', () => {
    const tree = render(<Container />);
    const rootChild = (tree.root as any).children[0];
    const style = flatten(rootChild.props.style);
    expect(style.backgroundColor).toBe(colors.fondo);
  });
});
