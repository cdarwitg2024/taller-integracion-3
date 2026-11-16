import React, { useEffect } from 'react';
import { BackHandler, View, Text, StyleSheet } from 'react-native';
import Header from '../components/Header';
import Button from '../components/Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function MisAfiliacionesScreen({ onBack }) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  return (
    <View style={styles.container}>
      <Header
        title="Mis afiliaciones"
        onBack={onBack}
        backAccessibilityLabel="Volver al perfil"
      />
      <View style={styles.content}>
        <Text style={styles.title}>Tu espacio de afiliaciones</Text>
        <Text style={styles.description}>
          Próximamente podrás consultar aquí tus solicitudes y códigos de afiliado.
        </Text>
        <Button title="Volver al perfil" onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: typography.titulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  description: { fontSize: typography.cuerpo, color: colors.textoSecundario, lineHeight: 22 },
});
