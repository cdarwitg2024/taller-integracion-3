import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { DESTINO_RETIRO_SIMULADO, validarMontoRetiroSimulado } from '../../utils/retiroSimulado';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function SolicitudRetiroSimulado({ disponible, confirmado }) {
  const [monto, setMonto] = useState('');
  const [resultado, setResultado] = useState(null);
  const actual = confirmado && resultado?.saldo === disponible && resultado?.texto === monto ? resultado : null;
  const revisar = () => {
    if (!confirmado) return;
    setResultado({ ...validarMontoRetiroSimulado(monto, disponible), texto: monto, saldo: disponible });
  };
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>Preparar retiro simulado</Text>
    <Text style={styles.texto}>Esta operación es simulada: no realizará una transferencia ni descontará tu saldo.</Text>
    <Text style={styles.texto}>{`Destino ficticio: ${DESTINO_RETIRO_SIMULADO}`}</Text>
    <Text style={styles.texto}>El monto se valida únicamente contra tu saldo disponible, sin incluir comisiones pendientes.</Text>
    {!confirmado && <Text accessibilityLiveRegion="polite" style={styles.texto}>Actualiza el saldo para habilitar la preparación del retiro.</Text>}
    <TextInput accessibilityLabel="Monto del retiro simulado en pesos chilenos"
      value={monto} onChangeText={valor => { setMonto(valor); setResultado(null); }}
      editable={confirmado} keyboardType="number-pad" placeholder="Monto en CLP, sin puntos ni comas"
      style={styles.input} />
    {actual?.error ? <Text accessibilityRole="alert" style={styles.error}>{actual.error}</Text> : null}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Revisar solicitud de retiro simulado"
      accessibilityState={{ disabled: !confirmado }} disabled={!confirmado} onPress={revisar} style={styles.boton}>
      <Text style={styles.botonTexto}>Revisar solicitud simulada</Text>
    </TouchableOpacity>
    {actual?.monto !== null && actual?.monto !== undefined && !actual.error && <View accessibilityLiveRegion="polite" style={styles.resumen}>
      <Text style={styles.titulo}>{`Monto válido para revisar: $${actual.monto.toLocaleString('es-CL')}`}</Text>
      <Text style={styles.texto}>{`Destino: ${DESTINO_RETIRO_SIMULADO}`}</Text>
      <Text style={styles.texto}>La solicitud simulada todavía no se ha enviado. Tu saldo no ha cambiado.</Text>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, gap: spacing.sm }, titulo: { color: colors.cafeOscuro, fontWeight: '700' },
  texto: { color: colors.textoSecundario, lineHeight: 22 }, error: { color: colors.rojo },
  input: { padding: spacing.md, borderWidth: 1, borderColor: colors.cafeOscuro, borderRadius: 10, color: colors.cafeOscuro, backgroundColor: colors.blanco },
  boton: { minHeight: 48, justifyContent: 'center', padding: spacing.md, borderRadius: 10, backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.blanco, fontWeight: '700' }, resumen: { gap: spacing.sm },
});
