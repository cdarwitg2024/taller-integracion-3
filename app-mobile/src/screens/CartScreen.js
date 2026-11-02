import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import AppIcon from '../components/AppIcon';

import CartItem from '../components/CartItem';
import { useCartTotals } from '../hooks/useCartTotals';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { franjaRetiroActual } from '../utils/franjas';

// Referencia horaria explícita utilizada para validar vencimiento
const getReferenciaHoraria = () => new Date();

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
  // Retiro inmediato elegido localmente. No depende de tablas de horarios.
  // Se conserva franja_retiro como HH:mm-HH:mm para backend y KDS.
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(false);
  const [ahora, setAhora] = useState(() => getReferenciaHoraria());
  const { totalProducts, subtotal, total } = useCartTotals(cart);

  // Actualizar referencia horaria mientras la pantalla esté visible
  useEffect(() => {
    const timer = setInterval(() => {
      setAhora(getReferenciaHoraria());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const franjaActual = useMemo(() => franjaRetiroActual(ahora), [ahora]);

  const handleCheckout = () => {
    if (paying) return;
    if (!franjaSeleccionada) {
      alert('Selecciona retirar lo antes posible para continuar.');
      return;
    }
    // Se calcula al confirmar: no enviar un horario viejo si cambió el minuto.
    onCheckout({ franja: franjaRetiroActual(getReferenciaHoraria()).id });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Tu Pedido"
        onBack={onBack}
        rightElement={
          <View style={styles.headerIcon}>
            <AppIcon name="cart" style={styles.headerIconText} />
          </View>
        }
      />

      {cart.length === 0 ? (
        <Card padding="lg" style={styles.emptyCard}>
          <AppIcon name="cart" style={styles.emptyIcon} />

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
                  <AppIcon name="location" style={styles.locationCircleIcon} />
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
                  Selecciona el retiro
                </Text>
                <TouchableOpacity
                  style={[styles.franjaChip, franjaSeleccionada && styles.franjaChipSelected]}
                  onPress={() => setFranjaSeleccionada(true)}
                  disabled={paying}
                  accessibilityRole="button"
                  accessibilityLabel="Retirar lo antes posible"
                  accessibilityState={{ disabled: paying, selected: Boolean(franjaSeleccionada) }}
                >
                  <Text style={[styles.franjaText, franjaSeleccionada && styles.franjaTextSelected]}>
                    Retirar lo antes posible
                  </Text>
                </TouchableOpacity>
                <Text style={styles.franjaEmptyText}>
                  Franja actual: {franjaActual.label}
                </Text>
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
                loading={paying}
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
  locationCircleIcon: { fontSize: 14, color: colors.cafeOscuro },

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

  franjaChipDisabled: {
    backgroundColor: colors.fondo,
    borderColor: colors.borde,
    opacity: 0.5,
  },

  franjaText: {
    fontSize: 11,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },

  franjaTextSelected: {
    color: colors.blanco,
  },

  franjaTextDisabled: {
    color: colors.textoSecundario,
  },

  franjaEmptyText: {
    marginTop: spacing.sm,
    fontSize: 10,
    color: colors.textoSecundario,
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

  emptyIcon: {
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
