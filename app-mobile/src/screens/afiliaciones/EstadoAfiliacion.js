import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import AppIcon from '../../components/AppIcon';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import AccionesCodigoAfiliado from './AccionesCodigoAfiliado';

const estados = {
  pendiente: { icono: 'clock', texto: 'Solicitud pendiente', detalle: 'La cafetería está revisándola.',
    fondo: colors.naranjaBg, tinta: colors.cafeOscuro },
  rechazada: { icono: 'close', texto: 'Solicitud rechazada', detalle: 'No tienes una afiliación aprobada para esta campaña.',
    fondo: colors.rojoBg, tinta: colors.rojo },
  aprobada: { icono: 'success', texto: 'Solicitud aprobada', fondo: colors.verdeBg, tinta: '#3D6335' },
};

export default function EstadoAfiliacion({ solicitud, confirmado = true }) {
  const estado = estados[solicitud.estado];
  return <View style={styles.container}>
    {estado && <View style={[styles.estado, { backgroundColor: estado.fondo }]}>
      <AppIcon name={estado.icono} style={{ color: estado.tinta, fontSize: 13 }} />
      <Text accessibilityLiveRegion="polite" style={[styles.estadoTexto, { color: estado.tinta }]}>{estado.texto}</Text>
    </View>}
    <Text accessibilityRole="header" style={styles.titulo}>{`Cafetería #${solicitud.cafeteria_id} · Campaña #${solicitud.campana_id}`}</Text>
    {estado?.detalle && <Text style={styles.texto}>{estado.detalle}</Text>}
    {solicitud.estado === 'aprobada' && (confirmado ? <>
      <View style={styles.bloqueCodigo}>
        <Text selectable style={styles.codigo}>{`Código: ${solicitud.codigo}`}</Text>
      </View>
      <Text style={styles.texto}>{solicitud.codigo_activo
        ? 'Código activo: puedes compartirlo. El descuento requiere una campaña vigente y el beneficio disponible del comprador.'
        : 'Código desactivado: ya no se puede usar en nuevas compras. Tu historial y saldo siguen disponibles.'}</Text>
      {solicitud.codigo_activo && <AccionesCodigoAfiliado
        key={`${solicitud.id}:${solicitud.cafeteria_id}:${solicitud.campana_id}:${solicitud.codigo}`}
        solicitud={solicitud} />}
    </> : <Text style={styles.texto}>Actualiza el estado para confirmar el código antes de compartirlo.</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, borderRadius: 14, backgroundColor: colors.fondo,
    borderWidth: 1, borderColor: colors.borde },
  estado: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 20 },
  estadoTexto: { fontWeight: '700', flexShrink: 1 },
  titulo: { fontWeight: '700', color: colors.cafeOscuro },
  texto: { color: colors.textoSecundario, lineHeight: 22 },
  codigo: { color: colors.cafeOscuro, fontWeight: '700', fontSize: 16 },
  bloqueCodigo: { backgroundColor: colors.blanco, borderRadius: 10, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.borde },
});
