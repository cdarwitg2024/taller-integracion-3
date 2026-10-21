import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/**
 * Contenedor de pantalla reutilizable de CoffeeFast.
 *
 * S2-T1: encapsula el patrón repetido
 *   SafeAreaView > (KeyboardAvoidingView) > (ScrollView)
 * que hoy se escribe a mano en cada pantalla, con el mismo fondo, las mismas
 * SafeArea y el mismo comportamiento de scroll/teclado.
 *
 * Props:
 * - children: Contenido de la pantalla
 * - scroll: Boolean. Envuelve el contenido en un ScrollView.
 * - keyboard: Boolean. Envuelve el contenido en un KeyboardAvoidingView.
 * - keyboardBehavior: Override del behavior del KeyboardAvoidingView
 *   (por defecto 'padding' en iOS y 'height' en Android, igual que las pantallas).
 * - backgroundColor: Fondo de la pantalla (por defecto `colors.fondo`).
 * - padding: 'none' | 'sm' | 'md' | 'lg' | 'xl' para el contenido.
 * - contentContainerStyle: Estilos del contenedor interno (pisa a `padding`).
 * - scrollViewProps / keyboardViewProps: Props extra para esos wrappers.
 * - style: Estilos del SafeAreaView externo.
 *
 * @type {React.FC<{
 *   children?: React.ReactNode,
 *   scroll?: boolean,
 *   keyboard?: boolean,
 *   keyboardBehavior?: 'height'|'position'|'padding'|undefined,
 *   backgroundColor?: string,
 *   padding?: 'none'|'sm'|'md'|'lg'|'xl',
 *   contentContainerStyle?: any,
 *   style?: any,
 *   scrollViewProps?: any,
 *   keyboardViewProps?: any,
 * }>}
 */
const Container = ({
  children,
  scroll = false,
  keyboard = false,
  keyboardBehavior,
  backgroundColor = colors.fondo,
  padding = 'none',
  contentContainerStyle,
  style = {},
  scrollViewProps = {},
  keyboardViewProps = {},
  ...rest
}) => {
  const contenido = scroll ? (
    <ScrollView
      contentContainerStyle={[PADDINGS[padding], contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, PADDINGS[padding], contentContainerStyle]}>
      {children}
    </View>
  );

  const conTeclado = keyboard ? (
    <KeyboardAvoidingView
      behavior={keyboardBehavior || (Platform.OS === 'ios' ? 'padding' : 'height')}
      style={styles.flex}
      {...keyboardViewProps}
    >
      {contenido}
    </KeyboardAvoidingView>
  ) : (
    contenido
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }, style]} {...rest}>
      {conTeclado}
    </SafeAreaView>
  );
};

const PADDINGS = {
  none: {},
  sm: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  md: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  lg: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  xl: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});

export default Container;
