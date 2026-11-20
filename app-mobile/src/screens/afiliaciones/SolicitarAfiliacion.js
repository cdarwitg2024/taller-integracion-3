import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { solicitarAfiliacion } from '../../services/afiliaciones';
import EstadoAfiliacion from './EstadoAfiliacion';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function SolicitarAfiliacion({ campana, solicitud, perfilEstado, onSolicitada }) {
  const [abierto, setAbierto] = useState(false);
  const [plan, setPlan] = useState('');
  const [enlace, setEnlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      if (montado.current) { onSolicitada?.(resultado); setAbierto(false); }
    } catch (fallo) {
      if (montado.current) setError(fallo.status === 409 ? 'Esta campaña ya no admite solicitudes. Actualiza las oportunidades.'
        : fallo.status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión.'
          : fallo.status === 403 ? 'Tu cuenta no tiene permiso para solicitar esta afiliación.'
            : fallo.status === 0 || fallo.status >= 500 ? 'No pudimos confirmar el envío. Puedes reintentar sin crear una solicitud duplicada.'
              : fallo.status ? 'Revisa el plan y el enlace de la solicitud.' : fallo.message || 'No se pudo enviar la solicitud. Puedes reintentar.');
    } finally {
      envio.current = false;
      if (montado.current) setBusy(false);
    }
  };
  if (perfilEstado === 'prohibido') return <Text accessibilityRole="alert" style={styles.error}>
    Tu cuenta no tiene permisos para solicitar afiliación. Contacta al administrador de la cafetería.
  </Text>;
  if (solicitud) return <EstadoAfiliacion solicitud={solicitud} confirmado={perfilEstado === 'listo'} />;
  if (perfilEstado !== 'listo') return <Text style={styles.texto}>Actualiza tus solicitudes para poder solicitar afiliación.</Text>;
  return <View style={styles.container}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Solicitar afiliación a ${campana.nombre}`}
      accessibilityState={{ expanded: abierto }} disabled={busy} onPress={() => setAbierto(valor => !valor)} style={styles.boton}>
      <Text style={styles.botonTexto}>Solicitar afiliación</Text>
    </TouchableOpacity>
    {abierto && <>
      <Text style={styles.texto}>Cuéntale a la cafetería cómo promocionarás esta campaña.</Text>
      <TextInput accessibilityLabel="Plan de promoción" multiline value={plan} editable={!busy}
        onChangeText={setPlan} style={styles.input} placeholder="Cómo promocionarás la campaña" />
      <TextInput accessibilityLabel="Enlace público opcional" value={enlace} editable={!busy} autoCapitalize="none"
        keyboardType="url" onChangeText={setEnlace} style={styles.input} placeholder="https://… (opcional)" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enviar solicitud de afiliación"
        accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={enviar} style={styles.boton}>
        <Text style={styles.botonTexto}>{busy ? 'Enviando solicitud…' : 'Enviar solicitud de afiliación'}</Text>
      </TouchableOpacity>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm }, texto: { color: colors.textoSecundario, lineHeight: 22 },
  boton: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.cafeOscuro, minHeight: 48 },
  botonTexto: { color: colors.blanco, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.borde, borderRadius: 10, padding: spacing.md, color: colors.cafeOscuro },
  error: { color: colors.rojo },
});
