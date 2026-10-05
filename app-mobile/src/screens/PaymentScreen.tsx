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
  onPagoExitoso: (monto: number) => void;
  onCancelar: () => void;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  monto,
  onPagoExitoso,
  onCancelar,
}) => {
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [titular, setTitular] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [pin, setPin] = useState('');
  const [tipoTarjeta, setTipoTarjeta] = useState('Visa');
  const [procesando, setProcesando] = useState(false);
  const [estadoPago, setEstadoPago] = useState<'exito' | 'error' | null>(null);

  // ─── Animaciones ─────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;
  const exitoAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

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

  React.useEffect(() => {
    if (procesando) {
      Animated.loop(
        Animated.timing(spinnerAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinnerAnim.setValue(0);
    }
  }, [procesando]);

  React.useEffect(() => {
    if (estadoPago === 'exito') {
      Animated.sequence([
        Animated.timing(exitoAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(exitoAnim, {
          toValue: 0,
          duration: 200,
          delay: 1500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onPagoExitoso(monto);
      });
    } else if (estadoPago === 'error') {
      Animated.sequence([
        Animated.timing(errorAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(errorAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(errorAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(errorAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [estadoPago]);

  // ─── Manejo de pago ──────────────────────────────────────────
  const handlePago = async () => {
    if (procesando) return;

    // Validar campos
    if (!validarNumeroTarjeta(numeroTarjeta)) {
      setEstadoPago('error');
      return;
    }
    if (!validarVencimiento(vencimiento)) {
      setEstadoPago('error');
      return;
    }
    if (!validarCVV(cvv)) {
      setEstadoPago('error');
      return;
    }
    if (!validarPIN(pin)) {
      setEstadoPago('error');
      return;
    }

    setProcesando(true);

    // Simular latencia de pago (500ms según SRS)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Tarjetas de prueba tienen saldo ilimitado - siempre se aprueba
    const tarjeta = TARJETAS_PRUEBA.find(t => t.numero === numeroTarjeta);
    const aprobado = tarjeta ? true : Math.random() > 0.01;

    setProcesando(false);

    if (aprobado) {
      setEstadoPago('exito');
    } else {
      setEstadoPago('error');
    }
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
        <ScrollView showsVerticalScrollIndicator={false}>
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

          {/* Estado del pago */}
          {procesando && (
            <Animated.View
              style={[
                styles.estadoBox,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      rotate: spinnerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ActivityIndicator size="large" color={colors.cafeOscuro} />
              <Text style={styles.estadoTexto}>Procesando pago...</Text>
            </Animated.View>
          )}

          {estadoPago === 'exito' && (
            <Animated.View
              style={[
                styles.estadoExitoBox,
                {
                  opacity: exitoAnim,
                  transform: [
                    {
                      scale: exitoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.estadoExitoTexto}>✓ Pago aprobado</Text>
            </Animated.View>
          )}

          {estadoPago === 'error' && (
            <Animated.View
              style={[
                styles.estadoErrorBox,
                {
                  opacity: errorAnim,
                },
              ]}
            >
              <Text style={styles.estadoErrorTexto}>
                ✕ Pago rechazado. Verifica los datos.
              </Text>
            </Animated.View>
          )}

          {/* Botón de pago */}
          <Button
            title={`Pagar ${formatCLP(monto)}`}
            onPress={handlePago}
            loading={procesando}
            disabled={procesando || !numeroTarjeta || !titular || !vencimiento || !cvv || !pin}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          <Text style={styles.notaSeguridad}>
            🔒 Pago simulado - No se procesará ningún cargo real
          </Text>
        </ScrollView>
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

  estadoBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  estadoTexto: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    marginTop: spacing.md,
  },
  estadoExitoBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.verdeBg,
    borderRadius: 12,
  },
  estadoExitoTexto: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoExtraBold,
    color: colors.verde,
  },
  estadoErrorBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.rojoBg,
    borderRadius: 12,
  },
  estadoErrorTexto: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.rojo,
    textAlign: 'center',
  },
  notaSeguridad: {
    fontSize: 11,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default PaymentScreen;
