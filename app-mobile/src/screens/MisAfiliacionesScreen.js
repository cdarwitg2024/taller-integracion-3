import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Header from '../components/Header';
import Button from '../components/Button';
import AppIcon from '../components/AppIcon';
import OportunidadesScreen from './afiliaciones/OportunidadesScreen';
import EstadoAfiliacion from './afiliaciones/EstadoAfiliacion';
import ComisionesAfiliado from './afiliaciones/ComisionesAfiliado';
import RetirosAfiliado from './afiliaciones/RetirosAfiliado';
import SaldoAfiliado from './afiliaciones/SaldoAfiliado';
import { consultarAfiliaciones } from '../services/afiliaciones';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const secciones = [
  { id: 'oportunidades', titulo: 'Oportunidades', icono: 'store', descripcion: 'Conoce las campañas de las cafeterías para promocionarlas.' },
  { id: 'codigos', titulo: 'Mis códigos', icono: 'number', descripcion: 'Encuentra los códigos de tus afiliaciones aprobadas.' },
  { id: 'ganancias', titulo: 'Ganancias', icono: 'card', descripcion: 'Consulta las comisiones de tus pedidos entregados.' },
  { id: 'historial', titulo: 'Historial', icono: 'receipt', descripcion: 'Consulta comisiones, reversiones y retiros por comprobante.' },
];

export default function MisAfiliacionesScreen({ onBack, nombreUsuario, usuarioId }) {
  const [seccion, setSeccion] = useState('inicio');
  const [perfil, setPerfil] = useState({ estado: 'cargando', solicitudes: [], error: '' });
  const consulta = useRef(0);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; consulta.current++; }; }, []);
  const recargar = useCallback(() => {
    if (!montado.current) return;
    const numero = ++consulta.current;
    setPerfil(prev => ({ ...prev, estado: 'cargando', error: '' }));
    consultarAfiliaciones().then(solicitudes => {
      if (montado.current && numero === consulta.current) setPerfil({ estado: 'listo', solicitudes, error: '' });
    }).catch(error => {
      if (montado.current && numero === consulta.current) setPerfil(prev => ({
        estado: error.status === 403 ? 'prohibido' : 'error', solicitudes: [401, 403].includes(error.status) ? [] : prev.solicitudes,
        error: error.status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión.'
          : error.status === 403 ? 'Tu cuenta no tiene permisos para consultar afiliaciones. Contacta al administrador de la cafetería.'
          : `No pudimos actualizar tus solicitudes. Intenta nuevamente.${prev.solicitudes.length ? ' Se conserva la última consulta.' : ''}`,
      }));
    });
  }, []);
  useEffect(() => { recargar(); return () => { consulta.current++; }; }, [recargar, seccion]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', estado => { if (estado === 'active') recargar(); });
    return () => listener.remove();
  }, [recargar]);
  const aprobadas = perfil.solicitudes.filter(s => s.estado === 'aprobada');
  const visibles = secciones.filter(s => s.id === 'oportunidades' || aprobadas.length > 0);
  const actual = visibles.find(item => item.id === seccion);
  useEffect(() => {
    if (seccion !== 'inicio' && !actual) setSeccion('inicio');
  }, [actual, seccion]);
  const alSolicitar = nueva => {
    if (!montado.current) return;
    setPerfil(prev => ({ ...prev, solicitudes: [...prev.solicitudes.filter(s =>
      s.cafeteria_id !== nueva.cafeteria_id || s.campana_id !== nueva.campana_id), nueva] }));
    recargar();
  };
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
        {perfil.estado === 'cargando' && <View><ActivityIndicator accessibilityLabel="Actualizando solicitudes" />
          <Text style={styles.description}>Actualizando el estado de tus solicitudes…</Text></View>}
        {perfil.error ? <Text accessibilityRole="alert" style={styles.error}>{perfil.error}</Text> : null}
        {perfil.estado !== 'prohibido' && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar mis solicitudes" onPress={recargar}>
          <Text style={styles.accesoTitulo}>Actualizar mis solicitudes</Text>
        </TouchableOpacity>}
        {actual ? (
          <>
            <View accessibilityRole="tablist" style={styles.tabs}>
              {visibles.map(item => (
                <TouchableOpacity key={item.id} accessibilityRole="tab"
                  accessibilityLabel={item.titulo} accessibilityState={{ selected: seccion === item.id }}
                  onPress={() => setSeccion(item.id)}
                  style={[styles.tab, seccion === item.id && styles.tabActiva]}>
                  <Text style={[styles.tabTexto, seccion === item.id && styles.tabTextoActivo]}>{item.titulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {seccion === 'oportunidades' && <OportunidadesScreen solicitudes={perfil.solicitudes}
              perfilEstado={perfil.estado} onSolicitada={alSolicitar} />}
            {seccion === 'codigos' && <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.title}>Tus solicitudes y códigos de afiliado</Text>
              {perfil.estado === 'listo' && perfil.solicitudes.length === 0 && <Text style={styles.description}>Todavía no tienes solicitudes de afiliación.</Text>}
              {perfil.solicitudes.map(s => <EstadoAfiliacion key={s.id} solicitud={s} confirmado={perfil.estado === 'listo'} />)}
            </View>}
            {['ganancias', 'historial'].includes(seccion) && <>
              <SaldoAfiliado usuarioId={usuarioId} revision={perfil.solicitudes} vista={seccion} />
              {aprobadas.filter(s => !s.codigo_activo).map(s => <Text key={s.id} style={styles.description}>
                {`El código está desactivado (cafetería #${s.cafeteria_id}, campaña #${s.campana_id}). Sus comisiones e historial siguen disponibles.`}
              </Text>)}
              {seccion === 'historial' && <Text accessibilityRole="header" style={styles.title}>Historial de ganancias y retiros</Text>}
              {seccion === 'historial' && <RetirosAfiliado revision={perfil.solicitudes} />}
              {seccion === 'historial' && aprobadas.map(s => <ComisionesAfiliado key={s.id} afiliacion={s} historial />)}
            </>}
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>Tu espacio de afiliaciones</Text>
            <Text style={styles.description}>Elige qué quieres consultar de tus afiliaciones.</Text>
            {perfil.estado === 'listo' && perfil.solicitudes.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.description}>
              Todavía no tienes solicitudes de afiliación. Explora las oportunidades disponibles.
            </Text>}
            {perfil.solicitudes.map(s => <EstadoAfiliacion key={s.id} solicitud={s} confirmado={perfil.estado === 'listo'} />)}
            {visibles.map(item => (
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
  error: { color: colors.rojo, lineHeight: 22 },
});
