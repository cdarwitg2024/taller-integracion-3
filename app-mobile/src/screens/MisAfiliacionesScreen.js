import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Header from '../components/Header';
import Button from '../components/Button';
import AppIcon from '../components/AppIcon';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const secciones = [
  { id: 'oportunidades', titulo: 'Oportunidades', icono: 'store', descripcion: 'Conoce las campañas de las cafeterías para promocionarlas.' },
  { id: 'codigos', titulo: 'Mis códigos', icono: 'number', descripcion: 'Encuentra los códigos de tus afiliaciones aprobadas.' },
  { id: 'ganancias', titulo: 'Ganancias', icono: 'card', descripcion: 'Consulta las comisiones de tus pedidos entregados.' },
];

function Oportunidades() {
  return <Vista titulo="Campañas de cafeterías" descripcion="Aquí podrás explorar las campañas disponibles para postular y conocer sus descuentos, comisión y vigencia." detalle="La consulta de oportunidades estará disponible próximamente." />;
}

function Codigos() {
  return <Vista titulo="Tus códigos de afiliado" descripcion="Cuando una cafetería apruebe tu solicitud, podrás consultar aquí el código asignado para compartirlo." detalle="La consulta de solicitudes y códigos estará disponible próximamente." />;
}

function Ganancias() {
  return <Vista titulo="Comisiones por entregas" descripcion="La comisión se genera cuando se entrega un pedido que usó tu código. Las compras con tu propio código no generan comisión." detalle="La consulta de ganancias estará disponible próximamente." />;
}

function Vista({ titulo, descripcion, detalle }) {
  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>{titulo}</Text>
      <Text style={styles.description}>{descripcion}</Text>
      <View style={styles.aviso}>
        <Text style={styles.description}>{detalle}</Text>
      </View>
    </View>
  );
}

export default function MisAfiliacionesScreen({ onBack, nombreUsuario }) {
  const [seccion, setSeccion] = useState('inicio');
  const actual = secciones.find(item => item.id === seccion);
  const volver = useCallback(() => {
    if (seccion === 'inicio') onBack();
    else setSeccion('inicio');
  }, [seccion, onBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      volver();
      return true;
    });
    return () => subscription.remove();
  }, [volver]);

  return (
    <View style={styles.container}>
      <Header
        title={actual?.titulo || 'Mis afiliaciones'}
        onBack={volver}
        backAccessibilityLabel={actual ? 'Volver a Mis afiliaciones' : 'Volver al perfil'}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.cuenta}>{nombreUsuario ? `Cuenta activa: ${nombreUsuario}` : 'Tu cuenta de estudiante'}</Text>
        {actual ? (
          <>
            <View accessibilityRole="tablist" style={styles.tabs}>
              {secciones.map(item => (
                <TouchableOpacity key={item.id} accessibilityRole="tab"
                  accessibilityLabel={item.titulo} accessibilityState={{ selected: seccion === item.id }}
                  onPress={() => setSeccion(item.id)}
                  style={[styles.tab, seccion === item.id && styles.tabActiva]}>
                  <Text style={[styles.tabTexto, seccion === item.id && styles.tabTextoActivo]}>{item.titulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {seccion === 'oportunidades' && <Oportunidades />}
            {seccion === 'codigos' && <Codigos />}
            {seccion === 'ganancias' && <Ganancias />}
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>Tu espacio de afiliaciones</Text>
            <Text style={styles.description}>Elige qué quieres consultar de tus afiliaciones.</Text>
            {secciones.map(item => (
              <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={item.titulo}
                accessibilityHint={`Abre la vista ${item.titulo}`} onPress={() => setSeccion(item.id)}
                style={styles.acceso}>
                <AppIcon name={item.icono} size={22} color={colors.cafeOscuro} />
                <View style={styles.accesoTexto}>
                  <Text style={styles.accesoTitulo}>{item.titulo}</Text>
                  <Text style={styles.description}>{item.descripcion}</Text>
                </View>
                <Text accessible={false} style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <Button title={actual ? 'Volver a Mis afiliaciones' : 'Volver al perfil'} onPress={volver} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: typography.titulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  description: { fontSize: typography.cuerpo, color: colors.textoSecundario, lineHeight: 22 },
  cuenta: { fontSize: typography.cuerpoPequeno, color: colors.cafeMedio },
  acceso: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.blanco, borderRadius: 16, borderWidth: 1, borderColor: colors.borde },
  accesoTexto: { flex: 1, gap: spacing.xs },
  accesoTitulo: { fontSize: typography.subtitulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  chevron: { fontSize: 26, color: colors.cafeMedio },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 12, backgroundColor: colors.blanco, borderWidth: 1, borderColor: colors.bordeOscuro },
  tabActiva: { backgroundColor: colors.cafeOscuro, borderColor: colors.cafeOscuro },
  tabTexto: { fontSize: typography.cuerpoPequeno, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  tabTextoActivo: { color: colors.blanco },
  panel: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.blanco,
    borderRadius: 16, borderWidth: 1, borderColor: colors.borde },
  aviso: { backgroundColor: colors.crema, padding: spacing.md, borderRadius: 12 },
});
