import { Alert } from 'react-native';
import { ErrorIntentoCompra } from './intentoCompra';

export function avisarErrorIntentoCompra(
  error: unknown, reiniciar: () => Promise<void>, revisarPedidos: () => void,
): boolean {
  if (!(error instanceof ErrorIntentoCompra)) return false;
  Alert.alert('Revisar intento de compra',
    `${error.message}\n\nReiniciar habilita una compra nueva. Comprueba antes en Pedidos que no exista un cobro confirmado.`, [
      { text: 'Revisar pedidos', onPress: revisarPedidos },
      { text: 'Reiniciar intento', onPress: async () => {
        try {
          await reiniciar();
          Alert.alert('Intento reiniciado', 'Puedes confirmar una compra nueva. No se ha enviado ningún pago.');
        } catch (fallo) { avisarErrorIntentoCompra(fallo, reiniciar, revisarPedidos); }
      } },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  return true;
}
