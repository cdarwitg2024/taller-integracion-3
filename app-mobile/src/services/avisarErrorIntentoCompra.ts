import { Alert } from 'react-native';
import { ErrorIntentoCompra } from './intentoCompra';

export function avisarErrorIntentoCompra(
  error: unknown, reiniciar: () => Promise<void>, revisarPedidos: () => void,
): boolean {
  if (!(error instanceof ErrorIntentoCompra)) return false;
  ofrecerResolverIntento('Revisar intento de compra', error.message, reiniciar, revisarPedidos);
  return true;
}

export function ofrecerResolverIntento(
  titulo: string, mensaje: string, reiniciar: () => Promise<void>, revisarPedidos: () => void,
) {
  Alert.alert(titulo, mensaje, [
      { text: 'Revisar pedidos', onPress: revisarPedidos },
      { text: 'Reiniciar intento', onPress: () => Alert.alert(
        '¿Ya revisaste tus pedidos?',
        'Si el pedido sigue sin aparecer y no puedes confirmar si hubo un cobro, espera antes de comprar otra vez. Reiniciar solo habilita una nueva confirmación manual.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ya revisé, reiniciar', onPress: async () => {
            try {
              await reiniciar();
              Alert.alert('Intento reiniciado', 'Ya puedes confirmar una compra nueva.');
            } catch (fallo) { avisarErrorIntentoCompra(fallo, reiniciar, revisarPedidos); }
          } },
        ],
      ) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
}
