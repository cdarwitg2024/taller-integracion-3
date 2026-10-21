import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Filtro por categoría — FR-07
 *
 * Recibe la lista de categorías y cuál está activa. Solo muestra las que
 * tienen al menos un producto (`count > 0`), para no poner chips vacíos.
 *
 * Componente tonto: no sabe nada de Supabase ni de cafeterías.
 */
const CategoryFilter = ({ categories, selected, onSelect, totalProducts }) => {
  if (!categories || categories.length === 0) return null;

  const todos = { id: 'todos', nombre: 'Todos', count: totalProducts };
  const opciones = [todos, ...categories];

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {opciones.map((cat) => {
          const activo = selected === cat.id;
          return (
            <TouchableOpacity
              key={String(cat.id)}
              style={[styles.chip, activo && styles.chipActive]}
              onPress={() => onSelect(cat.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Filtrar por ${cat.nombre}, ${cat.count} productos`}
            >
              <Text style={[styles.chipText, activo && styles.chipTextActive]}>
                {cat.nombre}
              </Text>
              <View style={[styles.badge, activo && styles.badgeActive]}>
                <Text style={[styles.badgeText, activo && styles.badgeTextActive]}>
                  {cat.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.blanco,
    paddingVertical: 8,
  },

  scroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipBg,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 7,
  },

  chipActive: {
    backgroundColor: colors.textoPrimario,
  },

  chipText: {
    color: colors.textoMedio,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
  },

  chipTextActive: {
    color: colors.textoBlanco,
  },

  badge: {
    marginLeft: 6,
    backgroundColor: colors.chipBadgeBg,
    borderRadius: radius.sm,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },

  badgeActive: {
    backgroundColor: colors.blancoTranslucido,
  },

  badgeText: {
    color: colors.textoMedio,
    fontSize: 9,
    fontWeight: typography.pesoExtraBold,
  },

  badgeTextActive: {
    color: colors.textoBlanco,
  },
});

export default CategoryFilter;
