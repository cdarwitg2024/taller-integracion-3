import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { solicitarAfiliacion } from '../../services/afiliaciones';
import AppIcon from '../../components/AppIcon';
import EstadoAfiliacion from './EstadoAfiliacion';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function SolicitarAfiliacion({ campana, solicitud, perfilEstado, onSolicitada }) {
  const [abierto, setAbierto] = useState(false);
  const [plan, setPlan] = useState('');
  const [enlace, setEnlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reintento, setReintento] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const envio = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const enviar = async () => {
    if (envio.current || perfilEstado !== 'listo') return;
    if (!plan.trim()) { setError('Explica cómo promocionarás la campaña.'); return; }
    envio.current = true;
    setBusy(true); setError('');
    try {
      const resultado = await solicitarAfiliacion(campana.cafeteria_id, campana.id, plan, enlace);
      if (montado.current) { setReintento(false); onSolicitada?.(resultado); setAbierto(false); }
    } catch (fallo) {
      if (montado.current) {
        setReintento(fallo.status === 0 || fallo.status >= 500 || fallo.resultadoIncierto === true);
        setBloqueado(fallo.status === 401 || fallo.status === 403);
        setError(fallo.status === 409 ? 'Esta campaña ya no admite solicitudes. Actualiza las oportunidades.'
        : fallo.status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión.'
          : fallo.status === 403 ? 'Tu cuenta no tiene permiso para solicitar esta afiliación.'
            : fallo.status === 0 || fallo.status >= 500 ? 'No pudimos confirmar el envío. Puedes reintentar sin crear una solicitud duplicada.'
              : fallo.status ? 'Revisa el plan y el enlace de la solicitud.' : fallo.message || 'No se pudo enviar la solicitud. Puedes reintentar.');
      }
    } finally {
      envio.current = false;
      if (montado.current) setBusy(false);
    }
  };
  if (perfilEstado === 'prohibido') return <Text accessibilityRole="alert" style={styles.error}>
    Tu cuenta no tiene permisos para solicitar afiliación. Contacta al administrador de la cafetería.
  </Text>;
  if (solicitud) return <EstadoAfiliacion solicitud={solicitud} confirmado={perfilEstado === 'listo'} />;
  if (bloqueado) return <Text accessibilityRole="alert" style={styles.error}>{error}</Text>;
  if (perfilEstado !== 'listo') return <Text style={styles.texto}>Actualiza tus solicitudes para poder solicitar afiliación.</Text>;
  return <View style={styles.container}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Solicitar afiliación a ${campana.nombre}`}
      accessibilityState={{ expanded: abierto, disabled: busy }} disabled={busy} onPress={() => setAbierto(valor => !valor)} style={styles.abrir}>
      <AppIcon name="edit" style={styles.icono} />
      <Text style={styles.abrirTexto}>Solicitar afiliación</Text>
      <AppIcon name={abierto ? 'chevronUp' : 'chevronDown'} style={styles.icono} />
    </TouchableOpacity>
    {abierto && <View style={styles.formulario}>
      <Text style={styles.texto}>Cuéntale a la cafetería cómo promocionarás esta campaña.</Text>
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Plan de promoción</Text>
        <TextInput accessibilityLabel="Plan de promoción" multiline value={plan} editable={!busy}
          onChangeText={setPlan} style={[styles.input, styles.plan]} placeholder="Cómo promocionarás la campaña" />
      </View>
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Enlace público <Text style={styles.texto}>(opcional)</Text></Text>
        <TextInput accessibilityLabel="Enlace público opcional" value={enlace} editable={!busy} autoCapitalize="none"
          keyboardType="url" onChangeText={setEnlace} style={styles.input} placeholder="https://…" />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {busy && <ActivityIndicator accessibilityLabel="Enviando solicitud de afiliación" color={colors.cafeOscuro} />}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={reintento ? 'Reintentar solicitud de afiliación' : 'Enviar solicitud de afiliación'}
        accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={enviar} style={styles.boton}>
        <Text accessibilityLiveRegion="polite" style={styles.botonTexto}>{busy ? 'Enviando solicitud…'
          : reintento ? 'Reintentar solicitud de afiliación' : 'Enviar solicitud de afiliación'}</Text>
      </TouchableOpacity>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm }, texto: { color: colors.textoSecundario, lineHeight: 22 },
  abrir: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.md,
    borderRadius: 12, backgroundColor: colors.crema },
  abrirTexto: { flex: 1, color: colors.cafeOscuro, fontWeight: '700' },
  icono: { color: colors.cafeOscuro, fontSize: 14 },
  formulario: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.fondo, borderRadius: 14,
    borderWidth: 1, borderColor: colors.borde },
  campo: { gap: spacing.xs },
  etiqueta: { color: colors.cafeOscuro, fontWeight: '700' },
  boton: { alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: 12,
    backgroundColor: colors.cafeOscuro, minHeight: 48 },
  botonTexto: { color: colors.blanco, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.bordeOscuro, borderRadius: 10, padding: spacing.md,
    backgroundColor: colors.blanco, color: colors.cafeOscuro },
  plan: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: colors.rojo },
});
