import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography, lineHeight } from '../theme/typography';

/**
 * Título + subtítulo reutilizable de CoffeeFast.
 *
 * S2-T1: centraliza el patrón repetido de encabezados de pantalla
 * (`<Text style={styles.title}>` + `<Text style={styles.subtitle}>`) para que
 * tamaño, peso, familia, color y separación sean iguales en toda la app.
 *
 * Props:
 * - title / children: Texto (o nodo) del título
 * - subtitle: Texto (o nodo) opcional debajo del título
 * - variant: 'display' (32) | 'h1' (28) | 'h2' (22) | 'h3' (20)
 * - align: 'left' | 'center'
 * - serif: Boolean. Usa la fuente de títulos (Georgia en iOS, serif en Android)
 * - color: Color del título (por defecto `colors.cafeOscuro`)
 * - style / titleStyle / subtitleStyle: Overrides puntuales
 *
 * @type {React.FC<{
 *   title?: React.ReactNode,
 *   subtitle?: React.ReactNode,
 *   children?: React.ReactNode,
 *   variant?: 'display'|'h1'|'h2'|'h3',
 *   align?: 'left'|'center'|'right',
 *   serif?: boolean,
 *   color?: string,
 *   style?: any,
 *   titleStyle?: any,
 *   subtitleStyle?: any,
 * }>}
 */
const Title = ({
  title,
  subtitle,
  children,
  variant = 'h1',
  align = 'left',
  serif = true,
  color = colors.cafeOscuro,
  style = {},
  titleStyle = {},
  subtitleStyle = {},
}) => {
  const contenido = title != null ? title : children;

  return (
    <View style={style}>
      {contenido != null && (
        <Text
          style={[
            styles.base,
            VARIANTES[variant],
            serif && styles.serif,
            { color, textAlign: align },
            titleStyle,
          ]}
        >
          {contenido}
        </Text>
      )}
      {subtitle != null && (
        <Text style={[styles.subtitle, { textAlign: align }, subtitleStyle]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
};

const VARIANTES = {
  display: { fontSize: 32, fontWeight: typography.pesoExtraBold },
  h1: { fontSize: typography.tituloGrande, fontWeight: typography.pesoExtraBold },
  h2: { fontSize: 22, fontWeight: typography.pesoExtraBold },
  h3: { fontSize: typography.titulo, fontWeight: typography.pesoBold },
};

const styles = StyleSheet.create({
  base: {
    // Sin margen por defecto: cada pantalla ajusta con titleStyle.
  },
  serif: {
    fontFamily: typography.familiaTitulo,
  },
  subtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: lineHeight.cuerpoPequeno,
    marginTop: spacing.xs,
  },
});

export default Title;
