import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import AccionesCodigoAfiliado from './AccionesCodigoAfiliado';

export default function EstadoAfiliacion({ solicitud, confirmado = true }) {
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>{`Cafetería #${solicitud.cafeteria_id} · Campaña #${solicitud.campana_id}`}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.texto}>
      {solicitud.estado === 'pendiente' ? 'Solicitud pendiente: la cafetería está revisándola.'
        : solicitud.estado === 'rechazada' ? 'Solicitud rechazada: no tienes una afiliación aprobada para esta campaña.'
          : 'Solicitud aprobada'}
    </Text>
    {solicitud.estado === 'aprobada' && (confirmado ? <>
      <Text selectable style={styles.codigo}>{`Código: ${solicitud.codigo}`}</Text>
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
  container: { padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.crema },
  titulo: { fontWeight: '700', color: colors.cafeOscuro },
  texto: { color: colors.textoSecundario, lineHeight: 22 },
  codigo: { color: colors.cafeOscuro, fontWeight: '700', fontSize: 16 },
});
