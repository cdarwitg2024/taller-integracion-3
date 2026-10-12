import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface Movimiento {
  id: string;
  tipo: 'recarga' | 'compra' | 'reembolso';
  monto: number;
  descripcion: string;
  creado_en: string;
}

interface MovimientoItemProps {
  mov: Movimiento;
  index: number;
}

const formatCLP = (monto: number): string => {
  return `$${Math.abs(monto).toLocaleString('es-CL')}`;
};

const formatFecha = (iso: string): string => {
  const fecha = new Date(iso);
  const ahora = new Date();
  const diffHoras = (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60);

  if (diffHoras < 1) {
    return 'Hace un momento';
  }
  if (diffHoras < 24) {
    return `Hace ${Math.floor(diffHoras)}h`;
  }
  if (diffHoras < 48) {
    return 'Ayer';
  }
  return fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTipoLabel = (tipo: string): string => {
  switch (tipo) {
    case 'recarga':
      return 'Recarga';
    case 'compra':
      return 'Compra';
    case 'reembolso':
      return 'Reembolso';
    default:
      return tipo;
  }
};

const MovimientoItem: React.FC<MovimientoItemProps> = ({ mov, index }) => {
  const esNuevo = String(mov?.id || '').startsWith('temp-');
  const entradaAnim = useRef(new Animated.Value(esNuevo ? 0 : 1)).current;


  useEffect(() => {
    if (esNuevo) {
      Animated.timing(entradaAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [esNuevo, entradaAnim]);

  return (
    <Animated.View
      style={[
        styles.movimientoCard,
        {
          opacity: entradaAnim,
          transform: [
            {
              translateY: entradaAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            {
              scale: entradaAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.movimientoIcon,
          mov.tipo === 'recarga' && styles.movimientoIconIn,
          mov.tipo === 'compra' && styles.movimientoIconOut,
          mov.tipo === 'reembolso' && styles.movimientoIconRefund,
        ]}
      >
        <Text style={styles.movimientoIconText}>
          {mov.tipo === 'recarga' ? '+' : mov.tipo === 'compra' ? '−' : '↩'}
        </Text>
      </View>
      <View style={styles.movimientoInfo}>
        <Text style={styles.movimientoName}>{mov.descripcion}</Text>
        <Text style={styles.movimientoMeta}>
          {getTipoLabel(mov.tipo)} • {formatFecha(mov.creado_en)}
        </Text>
      </View>
      <Text
        style={[
          styles.movimientoAmount,
          mov.tipo === 'recarga' && styles.movimientoAmountIn,
          mov.tipo === 'compra' && styles.movimientoAmountOut,
          mov.tipo === 'reembolso' && styles.movimientoAmountRefund,
        ]}
      >
        {mov.tipo === 'compra' ? '−' : '+'}
        {formatCLP(mov.monto)}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  movimientoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borde,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  movimientoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.rojoBg,
  },
  movimientoIconIn: {
    backgroundColor: colors.verdeBg,
  },
  movimientoIconOut: {
    backgroundColor: colors.rojoBg,
  },
  movimientoIconRefund: {
    backgroundColor: colors.doradoBg,
  },
  movimientoIconText: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
  },
  movimientoInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  movimientoName: {
    fontSize: 13,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
  },
  movimientoMeta: {
    fontSize: typography.etiqueta,
    color: colors.textoSecundario,
    marginTop: 2,
  },
  movimientoAmount: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoExtraBold,
  },
  movimientoAmountIn: {
    color: colors.verde,
  },
  movimientoAmountOut: {
    color: colors.rojo,
  },
  movimientoAmountRefund: {
    color: colors.dorado,
  },
});

export default MovimientoItem;
