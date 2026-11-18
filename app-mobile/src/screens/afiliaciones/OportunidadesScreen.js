import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { listarCafeteriasAfiliados, listarCampanasActivas, filtrarCampanasActivas } from '../../services/campanasAfiliados';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import CondicionesCampana from './CondicionesCampana';

function mensajeError(error) {
  if (error?.status === 501) return 'La consulta de oportunidades aún no está disponible. Intenta nuevamente más tarde.';
  if (error?.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión para consultar oportunidades.';
  if (error?.status === 403) return 'No tienes permiso para consultar las oportunidades de esta cafetería.';
  return 'No pudimos cargar la información. Revisa tu conexión e intenta nuevamente.';
}

function Accion({ titulo, onPress, seleccionada = false, expandida }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={titulo}
      accessibilityState={{ selected: seleccionada, ...(expandida === undefined ? {} : { expanded: expandida }) }} onPress={onPress}
      style={[styles.boton, seleccionada && styles.botonSeleccionado]}>
      <Text style={[styles.botonTexto, seleccionada && styles.botonTextoSeleccionado]}>{titulo}</Text>
    </TouchableOpacity>
  );
}

function Cargando({ texto }) {
  return <View style={styles.cargando}><ActivityIndicator color={colors.cafeOscuro} /><Text accessibilityLiveRegion="polite" style={styles.texto}>{texto}</Text></View>;
}

const tasa = valor => valor === null ? 'No especificado' : `${valor}%`;
const fecha = valor => new Date(valor).toLocaleString('es-CL');

export default function OportunidadesScreen() {
  const [catalogo, setCatalogo] = useState({ estado: 'cargando', filas: [], error: '' });
  const [cafeteriaId, setCafeteriaId] = useState(null);
  const [listado, setListado] = useState({ cafeteriaId: null, estado: 'inicial', filas: [], error: '' });
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const [intentoCampanas, setIntentoCampanas] = useState(0);
  const [reloj, setReloj] = useState(0);
  const [condicionesId, setCondicionesId] = useState(null);
  const solicitud = useRef(0);

  useEffect(() => {
    let activo = true;
    setCatalogo({ estado: 'cargando', filas: [], error: '' });
    listarCafeteriasAfiliados().then(filas => {
      if (activo) setCatalogo({ estado: 'listo', filas, error: '' });
    }).catch(error => {
      if (activo) setCatalogo({ estado: 'error', filas: [], error: mensajeError(error) });
    });
    return () => { activo = false; };
  }, [intentoCatalogo]);

  useEffect(() => {
    const numero = ++solicitud.current;
    if (!cafeteriaId) return undefined;
    setListado({ cafeteriaId, estado: 'cargando', filas: [], error: '' });
    listarCampanasActivas(cafeteriaId).then(filas => {
      if (numero === solicitud.current) setListado({ cafeteriaId, estado: 'listo', filas, error: '' });
    }).catch(error => {
      if (numero === solicitud.current) setListado({ cafeteriaId, estado: 'error', filas: [], error: mensajeError(error) });
    });
    return () => { solicitud.current++; };
  }, [cafeteriaId, intentoCampanas]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', estado => {
      if (estado === 'active') {
        setReloj(valor => valor + 1);
        setIntentoCampanas(valor => valor + 1);
      }
    });
    return () => listener.remove();
  }, []);

  // Oculta una campaña al vencer incluso si la pantalla permanece abierta.
  useEffect(() => {
    if (listado.estado !== 'listo' || listado.cafeteriaId !== cafeteriaId) return undefined;
    const ahora = Date.now();
    const vencimientos = listado.filas.map(c => Date.parse(c.vigencia_hasta)).filter(fin => fin > ahora);
    if (!vencimientos.length) return undefined;
    const demora = Math.min(Math.min(...vencimientos) - ahora, 2147483647);
    const timer = setTimeout(() => setReloj(valor => valor + 1), Math.max(1, demora));
    return () => clearTimeout(timer);
  }, [listado, cafeteriaId, reloj]);

  const seleccionar = id => {
    if (id === cafeteriaId) return;
    solicitud.current++;
    setCondicionesId(null);
    setListado({ cafeteriaId: null, estado: 'inicial', filas: [], error: '' });
    setCafeteriaId(id);
  };
  const cafeteria = catalogo.filas.find(c => c.id === cafeteriaId);
  const delAlcance = listado.cafeteriaId === cafeteriaId;
  const filas = delAlcance ? filtrarCampanasActivas(listado.filas) : [];

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.titulo}>Campañas de cafeterías</Text>
      <Text style={styles.texto}>Elige una cafetería para consultar sus campañas activas y vigentes.</Text>
      {catalogo.estado === 'cargando' && <Cargando texto="Cargando cafeterías…" />}
      {catalogo.estado === 'error' && <View style={styles.aviso}>
        <Text accessibilityRole="alert" style={styles.error}>{catalogo.error}</Text>
        <Accion titulo="Reintentar cafeterías" onPress={() => setIntentoCatalogo(valor => valor + 1)} />
      </View>}
      {catalogo.estado === 'listo' && catalogo.filas.length === 0 && <Text style={styles.texto}>No hay cafeterías disponibles para consultar oportunidades.</Text>}
      <View style={styles.selector}>
        {catalogo.filas.map(c => <Accion key={c.id} titulo={`Ver campañas de ${c.nombre}`}
          seleccionada={c.id === cafeteriaId} onPress={() => seleccionar(c.id)} />)}
      </View>
      {cafeteria && <Text accessibilityRole="header" style={styles.subtitulo}>{cafeteria.nombre}</Text>}
      {cafeteriaId && (!delAlcance || listado.estado === 'cargando') && <Cargando texto="Cargando campañas…" />}
      {delAlcance && listado.estado === 'error' && <View style={styles.aviso}>
        <Text accessibilityRole="alert" style={styles.error}>{listado.error}</Text>
        <Accion titulo="Reintentar campañas" onPress={() => setIntentoCampanas(valor => valor + 1)} />
      </View>}
      {delAlcance && listado.estado === 'listo' && <>
        {filas.length === 0 && <View style={styles.tarjeta}>
          <Text accessibilityLiveRegion="polite" style={styles.subtitulo}>No hay oportunidades disponibles</Text>
          <Text style={styles.texto}>Esta cafetería no tiene campañas activas y vigentes en este momento.</Text>
        </View>}
        {filas.map(c => <View key={c.id} style={styles.tarjeta}>
          <Text accessibilityRole="header" style={styles.subtitulo}>{c.nombre}</Text>
          <Text style={styles.estado}>Activa</Text>
          <Text style={styles.texto}>Cafetería: {c.cafeteria_nombre}</Text>
          <Text style={styles.texto}>Alcance: {c.tipo.replace(/_/g, ' ')}</Text>
          <Text style={styles.texto}>Descuento: {tasa(c.tasa_descuento)}</Text>
          <Text style={styles.texto}>Comisión: {tasa(c.tasa_comision)}</Text>
          <Text style={styles.texto}>Desde: {fecha(c.vigencia_desde)}</Text>
          <Text style={styles.texto}>Hasta: {fecha(c.vigencia_hasta)}</Text>
          {c.tipo === 'carrito_completo' && <>
            <Accion titulo={`${condicionesId === c.id ? 'Ocultar' : 'Ver'} condiciones de ${c.nombre}`}
              expandida={condicionesId === c.id}
              onPress={() => setCondicionesId(actual => actual === c.id ? null : c.id)} />
            {condicionesId === c.id && <CondicionesCampana campana={c} />}
          </>}
        </View>)}
        <Accion titulo="Actualizar campañas" onPress={() => setIntentoCampanas(valor => valor + 1)} />
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  titulo: { fontSize: typography.titulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  subtitulo: { fontSize: typography.subtitulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  texto: { fontSize: typography.cuerpo, color: colors.textoSecundario, lineHeight: 22 },
  selector: { gap: spacing.sm },
  boton: { minHeight: 48, justifyContent: 'center', padding: spacing.md, borderWidth: 1,
    borderColor: colors.bordeOscuro, borderRadius: 12, backgroundColor: colors.blanco },
  botonSeleccionado: { backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.cafeOscuro, fontWeight: typography.pesoBold },
  botonTextoSeleccionado: { color: colors.blanco },
  cargando: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tarjeta: { gap: spacing.sm, backgroundColor: colors.blanco, borderRadius: 16, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borde },
  aviso: { gap: spacing.sm, backgroundColor: colors.rojoBg, borderRadius: 12, padding: spacing.md },
  error: { color: colors.rojo, fontSize: typography.cuerpo, lineHeight: 22 },
  estado: { color: colors.verde, fontWeight: typography.pesoBold },
});
