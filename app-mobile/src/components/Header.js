import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import Icon from './Icon';

/**
 * Encabezado base de CoffeeFast
 * 
 * Props:
 * - title: Título del encabezado
 * - onBack: Función para retroceder (opcional)
 * - rightElement: Elemento a la derecha (opcional)
 * - variant: 'default' | 'transparent'
 *
 * @type {React.FC<{
 *   title: string,
 *   onBack?: () => void,
 *   rightElement?: React.ReactNode,
 *   variant?: 'default' | 'transparent',
 * }>}
 */
const Header = ({
  title,
  onBack,
  rightElement,
  variant = 'default',
}) => {
  return (
    <View style={[styles.container, variant === 'transparent' && styles.transparent]}>
      {onBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          {/* S2-T3: icono vectorial en vez del glifo '‹'. */}
          <Icon name="chevron-back" size={26} color={colors.textoPrimario} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={styles.title}>{title}</Text>
      {rightElement ? rightElement : <View style={styles.placeholder} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 72,
    backgroundColor: colors.blanco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  backButton: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoMedio,
    color: colors.textoPrimario,
  },
  placeholder: {
    width: 35,
  },
});

export default Header;
