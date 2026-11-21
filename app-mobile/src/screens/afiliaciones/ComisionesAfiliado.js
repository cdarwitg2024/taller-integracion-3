import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { consultarMovimientosComision, resumirComisiones } from '../../services/afiliaciones';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
const pesos = valor => `${valor < 0 ? '-' : ''}$${Math.abs(valor).toLocaleString('es-CL')}`;

export default function ComisionesAfiliado({ afiliacion, historial }) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState({ id: null, estado: 'cargando', filas: null, resumen: null, error: '' });
  useEffect(() => {
    let vigente = true;
    setDatos(prev => prev.id === afiliacion.id ? { ...prev, estado: 'cargando', error: '' }
      : { id: afiliacion.id, estado: 'cargando', filas: null, resumen: null, error: '' });
    consultarMovimientosComision(afiliacion.id).then(filas => {
      const resumen = resumirComisiones(filas);
      if (vigente) setDatos({ id: afiliacion.id, estado: 'listo', filas, resumen, error: '' });
    }).catch(() => {
      if (vigente) setDatos(prev => ({ ...prev, estado: 'error', error: 'No pudimos actualizar las comisiones. Intenta nuevamente.' }));
    });
    return () => { vigente = false; };
  }, [afiliacion.id, afiliacion.codigo_activo, historial, intento]);
  const actual = datos.id === afiliacion.id ? datos : { estado: 'cargando', filas: null };
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>{`Cafetería #${afiliacion.cafeteria_id} · Campaña #${afiliacion.campana_id}`}</Text>
    {!afiliacion.codigo_activo && <Text style={styles.texto}>El código está desactivado. Puedes consultar tus comisiones e historial.</Text>}
    {actual.estado === 'cargando' && <ActivityIndicator accessibilityLabel="Cargando comisiones" />}
    {actual.error ? <Text accessibilityRole="alert" style={styles.error}>{`${actual.error}${actual.filas ? ' Se conserva la última consulta.' : ''}`}</Text> : null}
    {actual.resumen && <Text style={styles.texto}>Movimientos de esta afiliación. El saldo total y los retiros se consultan en el resumen de tu cuenta.</Text>}
    {historial && actual.filas && <>
      {actual.filas.length === 0 && <Text style={styles.texto}>Todavía no hay movimientos de comisión registrados.</Text>}
      {[...actual.filas].reverse().map(m => <View key={m.id} style={styles.movimiento}>
        <Text style={styles.titulo}>{`${m.tipo === 'reversion' ? 'Reversión' : 'Comisión'} · Pedido #${m.pedido_id}`}</Text>
        <Text style={styles.texto}>{`${pesos(m.monto_clp)} · ${m.estado}`}</Text>
        <Text style={styles.texto}>{new Date(m.creado_en).toLocaleString('es-CL')}</Text>
      </View>)}
    </>}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Actualizar comisiones de afiliación ${afiliacion.id}`}
      onPress={() => setIntento(valor => valor + 1)} style={styles.boton}>
      <Text style={styles.botonTexto}>Actualizar comisiones</Text>
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.blanco },
  titulo: { color: colors.cafeOscuro, fontWeight: '700' }, texto: { color: colors.textoSecundario, lineHeight: 22 },
  error: { color: colors.rojo }, movimiento: { paddingVertical: spacing.sm, gap: spacing.xs, borderBottomWidth: 1, borderColor: colors.borde },
  boton: { padding: spacing.md, minHeight: 48, borderRadius: 10, backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.blanco, fontWeight: '700' },
});
