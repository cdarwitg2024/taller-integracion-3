import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { ejemploCampanaCarrito } from '../../utils/ejemploCampanaCarrito';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const pesos = valor => `$${valor.toLocaleString('es-CL')}`;
const porcentaje = valor => valor === null ? 'No especificado' : `${valor}%`;

export default function CondicionesCampana({ campana }) {
  const ejemplo = ejemploCampanaCarrito(campana);
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.titulo}>{`Condiciones de ${campana.nombre}`}</Text>
      <Text style={styles.texto}>{`Campaña de carrito completo de ${campana.cafeteria_nombre}.`}</Text>

      <View style={styles.bloque}>
        <Text accessibilityRole="header" style={styles.subtitulo}>Beneficio de tu referido</Text>
        <Text style={styles.texto}>{`Descuento para quien compra con tu código: ${porcentaje(campana.tasa_descuento)} en productos a precio normal.`}</Text>
        <Text style={styles.texto}>Cada usuario puede recibir el descuento de afiliado una sola vez en todo CoffeeFast, aunque ya haya comprado antes. Debe tener ese beneficio disponible.</Text>
      </View>
      <View style={styles.bloque}>
        <Text accessibilityRole="header" style={styles.subtitulo}>Tu ganancia como afiliado</Text>
        <Text style={styles.texto}>{`Comisión para ti: ${porcentaje(campana.tasa_comision)} sobre el subtotal de productos después del descuento.`}</Text>
        <Text style={styles.texto}>La comisión se genera cuando el pedido de tu referido se marca como entregado.</Text>
        <Text style={styles.texto}>Primero la cafetería debe aprobar tu afiliación y asignarte un código. Ver esta campaña no significa que ya estés aprobado.</Text>
      </View>

      <View style={styles.ejemplo}>
        <Text accessibilityRole="header" style={styles.subtitulo}>Ejemplo de compra referida</Text>
        {ejemplo ? <>
          <Text style={styles.texto}>{`Ejemplo ilustrativo con ${pesos(ejemplo.subtotal)} en productos a precio normal, sin otros cargos.`}</Text>
          <Text style={styles.texto}>{`Tu referido ahorra ${pesos(ejemplo.descuento)} y paga ${pesos(ejemplo.subtotalConDescuento)}.`}</Text>
          <Text style={styles.destacado}>{`Tú ganas ${pesos(ejemplo.comision)} cuando se entrega ese pedido.`}</Text>
          <Text style={styles.texto}>{`La comisión del ${porcentaje(campana.tasa_comision)} se calcula sobre ${pesos(ejemplo.subtotalConDescuento)}, después del descuento.`}</Text>
          <Text style={styles.texto}>Los importes se redondean al peso chileno más cercano; $0,50 se redondea hacia arriba.</Text>
        </> : <Text style={styles.texto}>La cafetería aún no especifica el descuento o la comisión. El ejemplo estará disponible cuando se informen.</Text>}
        <Text style={styles.nota}>Este ejemplo explica las condiciones; no es una cotización ni una ganancia registrada. El descuento de productos en oferta y el total final deben confirmarse en el carrito.</Text>
      </View>

      <View style={styles.bloque}>
        <Text accessibilityRole="header" style={styles.subtitulo}>Cuándo corresponde el beneficio</Text>
        <Text style={styles.texto}>El código debe corresponder a esta cafetería y la campaña debe estar activa y vigente al confirmar el pago.</Text>
        <Text style={styles.texto}>Puedes comprar con tu propio código si tienes el beneficio disponible; en esa compra tu comisión es $0.</Text>
        <Text style={styles.texto}>Si se cancela antes de la entrega y se reembolsa todo, el comprador recupera su beneficio y la comisión queda en $0.</Text>
        <Text style={styles.texto}>Una pausa impide aplicar el descuento a compras nuevas. Los pedidos ya pagados conservan sus condiciones hasta la entrega.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, marginTop: spacing.sm },
  titulo: { fontSize: typography.subtitulo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  subtitulo: { fontSize: typography.cuerpo, fontWeight: typography.pesoBold, color: colors.cafeOscuro },
  texto: { fontSize: typography.cuerpo, color: colors.textoSecundario, lineHeight: 22 },
  bloque: { gap: spacing.sm },
  ejemplo: { gap: spacing.sm, backgroundColor: colors.crema, padding: spacing.md, borderRadius: 12 },
  destacado: { fontSize: typography.cuerpo, fontWeight: typography.pesoBold, color: colors.cafeOscuro, lineHeight: 22 },
  nota: { fontSize: typography.cuerpo, color: colors.textoSecundario, lineHeight: 22 },
});
