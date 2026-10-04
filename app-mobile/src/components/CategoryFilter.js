import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

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
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },

  scroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EEEA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 7,
  },

  chipActive: {
    backgroundColor: '#4A332C',
  },

  chipText: {
    color: '#6B5850',
    fontSize: 12,
    fontWeight: '700',
  },

  chipTextActive: {
    color: '#FFFFFF',
  },

  badge: {
    marginLeft: 6,
    backgroundColor: '#E2D8D1',
    borderRadius: 8,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },

  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  badgeText: {
    color: '#6B5850',
    fontSize: 9,
    fontWeight: '800',
  },

  badgeTextActive: {
    color: '#FFFFFF',
  },
});

export default CategoryFilter;
