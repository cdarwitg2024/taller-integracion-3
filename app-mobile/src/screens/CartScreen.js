import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import CartItem from '../components/CartItem';
import { useCartTotals } from '../hooks/useCartTotals';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const FRANJAS = [
  { id: '12:00-12:15', label: '12:00 - 12:15' },
  { id: '12:15-12:30', label: '12:15 - 12:30' },
  { id: '12:30-12:45', label: '12:30 - 12:45' },
  { id: '12:45-13:00', label: '12:45 - 13:00' },
  { id: '13:00-13:15', label: '13:00 - 13:15' },
  { id: '13:15-13:30', label: '13:15 - 13:30' },
];

const CartScreen = ({
  cart,
  cafeteriaName,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  onBack,
  paying = false,
}) => {
  // Antes caía a 'Cafetería Central', un nombre inventado: si el usuario
  // perdía la cafetería seleccionada, el carrito mostraba un punto de retiro
  // falso. Ahora el nombre sale de los ítems del carrito y, si no hay, se
  // dice que no se pudo determinar.
  const cafeName = cafeteriaName || 'la cafetería de tu pedido';
  // Franja de retiro elegida (T3, de tu compañero). Se manda a la RPC
  // `procesar_pago` como p_franja_retiro. NO se persiste en AsyncStorage:
  // es un dato de ESTE pedido, y una franja vieja guardada podría estar
  // obsoleta (ya pasó la hora o el carrito cambió). Se elige en cada pedido.
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(null);
  const { totalProducts, subtotal, total } = useCartTotals(cart);

  const handleCheckout = () => {
    if (!franjaSeleccionada) {
      alert('Por favor selecciona una franja horaria para el retiro.');
      return;
    }
    onCheckout({ franja: franjaSeleccionada });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Tu Pedido"
        onBack={onBack}
        rightElement={
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        }
      />

      {cart.length === 0 ? (
        <Card padding="lg" style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🛒</Text>

          <Text style={styles.emptyTitle}>
            Tu carrito está vacío
          </Text>

          <Text style={styles.emptyDescription}>
            Agrega productos desde el menú para comenzar tu pedido.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <Card padding="sm" style={styles.pickupCard}>
                <View style={styles.locationCircle}>
                  <Text>●</Text>
                </View>

                <View style={styles.pickupInfo}>
                  <Text style={styles.pickupLabel}>
                    PUNTO DE RETIRO
                  </Text>

                  <Text style={styles.pickupName}>
                    {cafeName}
                  </Text>
                </View>

                <View style={styles.campusBadge}>
                  <Text style={styles.campusText}>
                    • UCT
                  </Text>
                </View>
              </Card>

              {/* Sección de Selección de Franja Horaria */}
              <View style={styles.franjaSection}>
                <Text style={styles.franjaTitle}>
                  Selecciona tu horario de retiro
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.franjaContainer}
                >
                  {FRANJAS.map((item) => {
                    const isSelected = franjaSeleccionada === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.franjaChip,
                          isSelected && styles.franjaChipSelected,
                        ]}
                        onPress={() => setFranjaSeleccionada(item.id)}
                      >
                        <Text
                          style={[
                            styles.franjaText,
                            isSelected && styles.franjaTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
              onRemove={onRemove}
            />
          )}
          ListFooterComponent={
            <>
              <Card padding="md" style={styles.readyCard}>
                <Text style={styles.bolt}>ϟ</Text>

                <View>
                  <Text style={styles.readyTitle}>
                    Listo en 6 - 8 minutos
                  </Text>

                  <Text style={styles.readyDescription}>
                    Sin espera en caja al retirar
                  </Text>
                </View>
              </Card>

              <Card padding="lg" style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.subtotalLabel}>
                    Subtotal ({totalProducts} productos)
                  </Text>

                  <Text style={styles.subtotal}>
                    ${subtotal.toLocaleString('es-CL')}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>
                      Total a Pagar
                    </Text>

                    <Text style={styles.iva}>
                      IVA incluido
                    </Text>
                  </View>

                  <Text style={styles.total}>
                    ${total.toLocaleString('es-CL')}
                  </Text>
                </View>
              </Card>

              <Button
                title={paying ? 'Procesando pago...' : 'Proceder al Pago'}
                onPress={handleCheckout}
                disabled={paying || !franjaSeleccionada}
              />

              <Text style={styles.footerText}>
                Retiro sin filas en Barra de {cafeName} • Campus UCT
              </Text>
            </>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },

  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerIconText: {
    color: colors.blanco,
  },

  list: {
    padding: spacing.lg,
    paddingBottom: 25,
  },

  pickupCard: {
    backgroundColor: colors.crema,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  locationCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.rojoBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pickupInfo: {
    flex: 1,
    marginLeft: 10,
  },

  pickupLabel: {
    fontSize: typography.micro,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
    letterSpacing: 0.5,
  },

  pickupName: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    marginTop: 2,
  },

  campusBadge: {
    backgroundColor: colors.blanco,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  campusText: {
    fontSize: 9,
    fontWeight: typography.pesoBold,
    color: colors.cafeMedio,
  },

  franjaSection: {
    marginBottom: spacing.lg,
  },

  franjaTitle: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: spacing.sm,
  },

  franjaContainer: {
    gap: spacing.sm,
  },

  franjaChip: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.borde,
  },

  franjaChipSelected: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },

  franjaText: {
    fontSize: 11,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },

  franjaTextSelected: {
    color: colors.blanco,
  },

  readyCard: {
    backgroundColor: colors.rojoBg,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: 14,
  },

  bolt: {
    fontSize: 23,
    fontWeight: 'bold',
    color: colors.cafeMedio,
    marginRight: 10,
  },

  readyTitle: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },

  readyDescription: {
    fontSize: 9,
    color: colors.textoSecundario,
    marginTop: 2,
  },

  summaryCard: {
    marginBottom: spacing.md,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  subtotalLabel: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
  },

  subtotal: {
    fontSize: typography.etiqueta,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoMedio,
  },

  divider: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: spacing.md,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontFamily: typography.familia,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },

  iva: {
    fontSize: typography.micro,
    color: colors.textoDeshabilitado,
    marginTop: 2,
  },

  total: {
    fontSize: 18,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },

  footerText: {
    textAlign: 'center',
    fontSize: typography.micro,
    color: colors.textoSecundario,
    marginTop: spacing.sm,
  },

  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    margin: spacing.lg,
  },

  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },

  emptyDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});

export default CartScreen;
