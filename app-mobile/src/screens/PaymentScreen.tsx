import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Button from '../components/Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// ─── Tarjetas de prueba ─────────────────────────────────────────
// Saldo ilimitado para pruebas - no hay validación de saldo real
const TARJETAS_PRUEBA = [
  {
    id: 'visa',
    tipo: 'Visa',
    numero: '4111 1111 1111 1111',
    titular: 'DIEGO CORDOVA',
    vencimiento: '12/28',
    cvv: '123',
    pin: '1234',
    color: '#1A1F71',
    saldo: 999999999,
  },
  {
    id: 'mastercard',
    tipo: 'Mastercard',
    numero: '5500 0000 0000 0004',
    titular: 'DIEGO CORDOVA',
    vencimiento: '06/27',
    cvv: '456',
    pin: '5678',
    color: '#EB001B',
    saldo: 999999999,
  },
];

const TIPOS_TARJETA = ['Visa', 'Mastercard'];

// ─── Helpers de validación ──────────────────────────────────────
const formatearNumeroTarjeta = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 16);
  return numeros.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const formatearVencimiento = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 4);
  if (numeros.length >= 2) {
    return numeros.slice(0, 2) + '/' + numeros.slice(2);
  }
  return numeros;
};

const validarNumeroTarjeta = (valor: string): boolean => {
  const numeros = valor.replace(/\s/g, '');
  return numeros.length === 16 && /^\d+$/.test(numeros);
};

const validarVencimiento = (valor: string): boolean => {
  const match = valor.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const mes = parseInt(match[1], 10);
  const anio = parseInt(match[2], 10);
  return mes >= 1 && mes <= 12 && anio >= 24;
};

const validarCVV = (valor: string): boolean => {
  return /^\d{3}$/.test(valor);
};

const validarPIN = (valor: string): boolean => {
  return /^\d{4}$/.test(valor);
};

// ─── Componente Principal ────────────────────────────────────────
interface PaymentScreenProps {
  monto: number;
  /** Se dispara al confirmar. NO significa que la recarga haya pasado: el
   *  resultado real lo devuelve la RPC `recargar_saldo` y lo muestra el padre
   *  en su popup. Aquí solo se validan los datos de la tarjeta. */
  onConfirmar: (monto: number) => void;
  onCancelar: () => void;
  procesando: boolean;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  monto,
  onConfirmar,
  onCancelar,
  procesando,
}) => {
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [titular, setTitular] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [pin, setPin] = useState('');
  const [tipoTarjeta, setTipoTarjeta] = useState('Visa');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);

  // ─── Animaciones ─────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ─── Confirmación ────────────────────────────────────────────
  // Acá solo se valida el formulario de la tarjeta. El "pago" es simulado y
  // la recarga real la hace la RPC `recargar_saldo` desde el padre, que es
  // quien decide si se muestra el ✓ o el ✕. Antes esta función se aprobaba a
  // sí misma con `Math.random()` y pintaba "Pago aprobado" sin haber tocado la
  // base: el usuario veía un éxito que todavía no había ocurrido.
  const handleConfirmar = () => {
    if (procesando) return;

    if (!validarNumeroTarjeta(numeroTarjeta)) {
      setErrorCampo('El número de tarjeta debe tener 16 dígitos.');
      return;
    }
    if (!titular.trim()) {
      setErrorCampo('Escribe el nombre del titular.');
      return;
    }
    if (!validarVencimiento(vencimiento)) {
      setErrorCampo('Vencimiento inválido. Usa el formato MM/AA.');
      return;
    }
    if (!validarCVV(cvv)) {
      setErrorCampo('El CVV debe tener 3 dígitos.');
      return;
    }
    if (!validarPIN(pin)) {
      setErrorCampo('El PIN debe tener 4 dígitos.');
      return;
    }

    setErrorCampo(null);
    onConfirmar(monto);
  };

  const usarTarjetaPrueba = (tarjeta: typeof TARJETAS_PRUEBA[0]) => {
    setNumeroTarjeta(tarjeta.numero);
    setTitular(tarjeta.titular);
    setVencimiento(tarjeta.vencimiento);
    setCvv(tarjeta.cvv);
    setPin(tarjeta.pin);
    setTipoTarjeta(tarjeta.tipo);
  };

  const formatCLP = (valor: number): string => {
    return `$${valor.toLocaleString('es-CL')}`;
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* flexShrink: sin esto el ScrollView toma su altura natural completa
            y empuja el pie (botón) fuera del maxHeight de la tarjeta, que es
            justo lo que hacía il-localizable al botón: quedaba invisible. */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pago con tarjeta</Text>
            <TouchableOpacity onPress={onCancelar}>
              <Text style={styles.headerClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Monto */}
          <View style={styles.montoBox}>
            <Text style={styles.montoLabel}>Monto a pagar</Text>
            <Text style={styles.montoValor}>{formatCLP(monto)}</Text>
          </View>

          {/* Tarjetas de prueba */}
          <View style={styles.pruebaSection}>
            <Text style={styles.pruebaTitulo}>Tarjetas de prueba</Text>
            {TARJETAS_PRUEBA.map((tarjeta) => (
              <TouchableOpacity
                key={tarjeta.id}
                style={styles.pruebaTarjeta}
                onPress={() => usarTarjetaPrueba(tarjeta)}
              >
                <View
                  style={[
                    styles.pruebaTarjetaIcono,
                    { backgroundColor: tarjeta.color },
                  ]}
                >
                  <Text style={styles.pruebaTarjetaTipo}>{tarjeta.tipo}</Text>
                </View>
                <View style={styles.pruebaTarjetaInfo}>
                  <Text style={styles.pruebaTarjetaNumero}>{tarjeta.numero}</Text>
                  <Text style={styles.pruebaTarjetaDetalle}>
                    CVV: {tarjeta.cvv} • PIN: {tarjeta.pin}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Formulario */}
          <View style={styles.formulario}>
            {/* Tipo de tarjeta */}
            <Text style={styles.label}>Tipo de tarjeta</Text>
            <View style={styles.tipoSelector}>
              {TIPOS_TARJETA.map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.tipoBoton,
                    tipoTarjeta === tipo && styles.tipoBotonActivo,
                  ]}
                  onPress={() => setTipoTarjeta(tipo)}
                >
                  <Text
                    style={[
                      styles.tipoBotonTexto,
                      tipoTarjeta === tipo && styles.tipoBotonTextoActivo,
                    ]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Número de tarjeta */}
            <Text style={styles.label}>Número de tarjeta</Text>
            <TextInput
              style={styles.input}
              placeholder="0000 0000 0000 0000"
              keyboardType="numeric"
              value={numeroTarjeta}
              onChangeText={(text) => setNumeroTarjeta(formatearNumeroTarjeta(text))}
              maxLength={19}
            />

            {/* Titular */}
            <Text style={styles.label}>Titular de la tarjeta</Text>
            <TextInput
              style={styles.input}
              placeholder="NOMBRE APELLIDO"
              value={titular}
              onChangeText={(text) => setTitular(text.toUpperCase())}
              autoCapitalize="characters"
            />

            {/* Vencimiento y CVV */}
            <View style={styles.filaDoble}>
              <View style={styles.columnaMitad}>
                <Text style={styles.label}>Vencimiento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/AA"
                  keyboardType="numeric"
                  value={vencimiento}
                  onChangeText={(text) => setVencimiento(formatearVencimiento(text))}
                  maxLength={5}
                />
              </View>
              <View style={styles.columnaMitad}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  keyboardType="numeric"
                  value={cvv}
                  onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                  secureTextEntry
                />
              </View>
            </View>

            {/* PIN */}
            <Text style={styles.label}>PIN de seguridad</Text>
            <TextInput
              style={styles.input}
              placeholder="1234"
              keyboardType="numeric"
              value={pin}
              onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              secureTextEntry
            />

          </View>

{errorCampo && (
            <View style={styles.errorCampoBox}>
              <Text style={styles.errorCampoTexto}>✕ {errorCampo}</Text>
            </View>
          )}

          {procesando && (
            <View style={styles.procesandoBox}>
              <ActivityIndicator size="large" color={colors.cafeOscuro} />
              <Text style={styles.procesandoTexto}>Recargando saldo...</Text>
            </View>
          )}

          <Text style={styles.notaSeguridad}>
            🔒 Pago simulado - No se procesará ningún cargo real
          </Text>
        </ScrollView>

        {/* El botón va FUERA del ScrollView: antes quedaba bajo el fold (había
            que hacer scroll para encontrarlo) y con el formulario lleno se
            perdía de vista justo cuando el usuario decide confirmar. */}
        <View style={styles.footer}>
          <Button
            title={procesando ? 'Recargando...' : `Confirmar recarga ${formatCLP(monto)}`}
            onPress={handleConfirmar}
            loading={procesando}
            disabled={procesando || !numeroTarjeta || !titular || !vencimiento || !cvv || !pin}
            size="lg"
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.blanco,
    borderRadius: 24,
    padding: spacing.xxl,
    maxHeight: '90%',
  },
  scroll: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  headerClose: {
    fontSize: 18,
    color: colors.textoSecundario,
    fontWeight: typography.pesoBold,
    padding: spacing.xs,
  },
  montoBox: {
    backgroundColor: colors.crema,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  montoLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginBottom: spacing.xs,
  },
  montoValor: {
    fontSize: typography.tituloGrande,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
  },
  pruebaSection: {
    marginBottom: spacing.xl,
  },
  pruebaTitulo: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
    marginBottom: spacing.sm,
  },
  pruebaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fondo,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  pruebaTarjetaIcono: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pruebaTarjetaTipo: {
    color: colors.blanco,
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
  },
  pruebaTarjetaInfo: {
    flex: 1,
  },
  pruebaTarjetaNumero: {
    fontSize: 13,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },
  pruebaTarjetaDetalle: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: spacing.xs,
  },
  formulario: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.fondo,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  filaDoble: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  columnaMitad: {
    flex: 1,
  },
  tipoSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tipoBoton: {
    flex: 1,
    backgroundColor: colors.fondo,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  tipoBotonActivo: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },
  tipoBotonTexto: {
    fontSize: 13,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },
  tipoBotonTextoActivo: {
    color: colors.blanco,
  },

  // ─── Estado del formulario de tarjeta ───────────────────────
  errorCampoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.rojoBg,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  errorCampoTexto: {
    flex: 1,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio as '600',
    color: colors.rojo,
  },
  procesandoBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  procesandoTexto: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoMedio as '600',
    color: colors.cafeOscuro,
    marginTop: spacing.sm,
  },
  notaSeguridad: {
    fontSize: 11,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Pie fijo: mantiene el botón siempre alcanzable, sin depender del scroll.
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
    backgroundColor: colors.blanco,
  },
});

export default PaymentScreen;
