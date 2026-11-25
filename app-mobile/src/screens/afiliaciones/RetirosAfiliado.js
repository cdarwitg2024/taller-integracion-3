import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { consultarRetirosAfiliado } from '../../services/retirosAfiliado';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function RetirosAfiliado({ revision, retiroRevision, seleccion }) {
  const [busqueda, setBusqueda] = useState(seleccion?.referencia || '');
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState({ estado: 'cargando', filas: null, error: '', restringido: false });
  useEffect(() => { if (seleccion) setBusqueda(seleccion.referencia); }, [seleccion]);
  useEffect(() => {
    let vigente = true;
    setDatos(prev => ({ ...prev, estado: 'cargando', error: '' }));
    consultarRetirosAfiliado().then(filas => {
      if (vigente) setDatos({ estado: 'listo', filas, error: '', restringido: false });
    }).catch(error => {
      if (vigente) setDatos(prev => ({ estado: 'error',
        filas: [401, 403].includes(error.status) ? null : prev.filas,
        error: error.message || 'No pudimos consultar los retiros. Intenta nuevamente.',
        restringido: [401, 403].includes(error.status),
      }));
    });
    return () => { vigente = false; };
  }, [revision, intento, retiroRevision]);
  const referencia = busqueda.trim().toLowerCase();
  const visibles = datos.filas?.filter(fila => !referencia || fila.referencia?.toLowerCase().includes(referencia))
    .slice().sort((a, b) => Date.parse(b.creado_en) - Date.parse(a.creado_en) || b.id - a.id);
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>Retiros de tus ganancias</Text>
    <Text style={styles.texto}>Retiros simulados confirmados de tu cuenta, separados de la Wallet de compras. No son transferencias bancarias reales.</Text>
    {datos.estado === 'cargando' && <ActivityIndicator accessibilityLabel="Cargando historial de retiros" />}
    {datos.error ? <Text accessibilityRole="alert" style={styles.error}>
      {`${datos.error}${datos.filas ? ' Se conserva la última consulta.' : ''}`}
    </Text> : null}
    {datos.filas && <>
      <Text style={styles.titulo}>Buscar retiro por referencia de comprobante</Text>
      <TextInput accessibilityLabel="Buscar retiro por referencia de comprobante"
        placeholder="Referencia completa o parte de ella" value={busqueda} onChangeText={setBusqueda}
        autoCapitalize="none" autoCorrect={false} style={styles.campo} />
      {busqueda !== '' && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Limpiar búsqueda de comprobante"
        onPress={() => setBusqueda('')} style={styles.boton}>
        <Text style={styles.botonTexto}>Limpiar búsqueda</Text>
      </TouchableOpacity>}
      {datos.filas.length === 0 ? <Text style={styles.texto}>Todavía no tienes retiros registrados.</Text>
        : visibles.length === 0 ? <Text accessibilityLiveRegion="polite" style={styles.texto}>No hay retiros con esa referencia.</Text> : null}
      {visibles.map(fila => <View key={fila.id} style={styles.movimiento}>
        <Text style={styles.titulo}>Retiro simulado</Text>
        <Text style={styles.texto}>{`-$${fila.monto_clp.toLocaleString('es-CL')} · confirmado`}</Text>
        <Text style={styles.texto}>{new Date(fila.creado_en).toLocaleString('es-CL')}</Text>
        <Text selectable style={styles.texto}>{fila.referencia ? `Comprobante: ${fila.referencia}`
          : 'Sin comprobante: retiro histórico.'}</Text>
      </View>)}
    </>}
    {!datos.restringido && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar historial de retiros"
      disabled={datos.estado === 'cargando'} accessibilityState={{ disabled: datos.estado === 'cargando', busy: datos.estado === 'cargando' }}
      onPress={() => setIntento(valor => valor + 1)} style={styles.boton}>
      <Text style={styles.botonTexto}>Actualizar retiros</Text>
    </TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.blanco },
  titulo: { color: colors.cafeOscuro, fontWeight: '700' }, texto: { color: colors.textoSecundario, lineHeight: 22 },
  error: { color: colors.rojo }, campo: { borderWidth: 1, borderColor: colors.bordeOscuro, borderRadius: 10, padding: spacing.md, color: colors.cafeOscuro },
  movimiento: { paddingVertical: spacing.sm, gap: spacing.xs, borderBottomWidth: 1, borderColor: colors.borde },
  boton: { padding: spacing.md, minHeight: 48, borderRadius: 10, backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.blanco, fontWeight: '700' },
});
