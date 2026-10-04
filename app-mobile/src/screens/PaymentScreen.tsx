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
              <ActivityIndicator size="large" color="#4A332C" />
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
          <TouchableOpacity
            style={[
              styles.pagoBoton,
              (procesando || !numeroTarjeta || !titular || !vencimiento || !cvv || !pin) &&
                styles.pagoBotonDeshabilitado,
            ]}
            onPress={handlePago}
            disabled={procesando || !numeroTarjeta || !titular || !vencimiento || !cvv || !pin}
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.pagoBotonTexto}>
                Pagar {formatCLP(monto)}
              </Text>
            )}
          </TouchableOpacity>

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
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A332C',
  },
  headerClose: {
    fontSize: 18,
    color: '#8A7B76',
    fontWeight: '700',
    padding: 4,
  },
  montoBox: {
    backgroundColor: '#F5ECE5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  montoLabel: {
    fontSize: 12,
    color: '#8A7B76',
    marginBottom: 4,
  },
  montoValor: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4A332C',
    fontFamily: 'serif',
  },
  pruebaSection: {
    marginBottom: 20,
  },
  pruebaTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7B76',
    marginBottom: 8,
  },
  pruebaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6F4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFE7DD',
  },
  pruebaTarjetaIcono: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pruebaTarjetaTipo: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pruebaTarjetaInfo: {
    flex: 1,
  },
  pruebaTarjetaNumero: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A332C',
  },
  pruebaTarjetaDetalle: {
    fontSize: 11,
    color: '#8A7B76',
    marginTop: 2,
  },
  formulario: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7B76',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F8F6F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#4A332C',
    borderWidth: 1,
    borderColor: '#EFE7DD',
  },
  filaDoble: {
    flexDirection: 'row',
    gap: 12,
  },
  columnaMitad: {
    flex: 1,
  },
  tipoSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  tipoBoton: {
    flex: 1,
    backgroundColor: '#F8F6F4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFE7DD',
  },
  tipoBotonActivo: {
    backgroundColor: '#4A332C',
    borderColor: '#4A332C',
  },
  tipoBotonTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A332C',
  },
  tipoBotonTextoActivo: {
    color: '#FFFFFF',
  },

  estadoBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  estadoTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A332C',
    marginTop: 12,
  },
  estadoExitoBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#E8F3E4',
    borderRadius: 12,
  },
  estadoExitoTexto: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5B8C51',
  },
  estadoErrorBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FCEAE3',
    borderRadius: 12,
  },
  estadoErrorTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A92A2A',
    textAlign: 'center',
  },
  pagoBoton: {
    backgroundColor: '#4A332C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pagoBotonDeshabilitado: {
    backgroundColor: '#B5A89E',
  },
  pagoBotonTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  notaSeguridad: {
    fontSize: 11,
    color: '#8A7B76',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default PaymentScreen;
