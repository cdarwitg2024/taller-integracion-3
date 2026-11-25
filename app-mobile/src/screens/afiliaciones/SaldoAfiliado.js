import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { consultarSaldoAfiliado } from '../../services/saldoAfiliado';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import SolicitudRetiroSimulado from './SolicitudRetiroSimulado';
const pesos = valor => `${valor < 0 ? '-' : ''}$${Math.abs(valor).toLocaleString('es-CL')}`;

export default function SaldoAfiliado({ revision, vista, usuarioId }) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState({ estado: 'cargando', saldo: null, error: '', prohibido: false });
  useEffect(() => {
    let vigente = true;
    setDatos(prev => ({ ...prev, estado: 'cargando', error: '' }));
    consultarSaldoAfiliado().then(saldo => {
      if (vigente) setDatos({ estado: 'listo', saldo, error: '', prohibido: false });
    }).catch(error => {
      if (vigente) setDatos(prev => ({ estado: 'error',
        saldo: [401, 403].includes(error.status) ? null : prev.saldo,
        error: error.message || 'No pudimos consultar el saldo. Intenta nuevamente.',
        prohibido: error.status === 403,
      }));
    });
    return () => { vigente = false; };
  }, [revision, vista, intento]);
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>Saldo de tus comisiones</Text>
    <Text style={styles.texto}>Total de todas tus afiliaciones, separado del saldo de tu Wallet de compras.</Text>
    {datos.estado === 'cargando' && <ActivityIndicator accessibilityLabel="Actualizando saldo de comisiones" />}
    {datos.error ? <Text accessibilityRole="alert" style={styles.error}>
      {`${datos.error}${datos.saldo ? ' Se conserva la última consulta.' : ''}`}
    </Text> : null}
    {datos.saldo && <View accessibilityLiveRegion="polite" style={styles.importes}>
      <Text style={styles.texto}>{`Comisiones pendientes: ${pesos(datos.saldo.pendiente_clp)}`}</Text>
      <Text style={styles.titulo}>{`Saldo disponible para retirar: ${pesos(datos.saldo.disponible_clp)}`}</Text>
      <Text style={styles.texto}>{`Comisiones retiradas: ${pesos(datos.saldo.retirado_clp)}`}</Text>
    </View>}
    <Text style={styles.texto}>Las comisiones pendientes no están disponibles para retiro. El disponible ya descuenta los retiros confirmados.</Text>
    {datos.saldo && <SolicitudRetiroSimulado key={usuarioId} usuarioId={usuarioId} disponible={datos.saldo.disponible_clp}
      confirmado={datos.estado === 'listo'} onConfirmado={() => setIntento(valor => valor + 1)}
      onAccesoDenegado={status => setDatos({ estado: 'error', saldo: null, prohibido: status === 403,
        error: status === 403 ? 'Tu cuenta no tiene permisos para retirar.' : 'Tu sesión venció. Vuelve a iniciar sesión.' })} />}
    {!datos.prohibido && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar saldo de comisiones"
      disabled={datos.estado === 'cargando'} accessibilityState={{ disabled: datos.estado === 'cargando', busy: datos.estado === 'cargando' }}
      onPress={() => setIntento(valor => valor + 1)} style={styles.boton}>
      <Text style={styles.botonTexto}>Actualizar saldo</Text>
    </TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.crema },
  importes: { gap: spacing.sm }, titulo: { color: colors.cafeOscuro, fontWeight: '700' },
  texto: { color: colors.textoSecundario, lineHeight: 22 }, error: { color: colors.rojo },
  boton: { padding: spacing.md, minHeight: 48, borderRadius: 10, backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.blanco, fontWeight: '700' },
});
