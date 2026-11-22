import React, { useEffect, useRef, useState } from 'react';
import { Share, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function AccionesCodigoAfiliado({ solicitud }) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState({ texto: '', error: false });
  const pendiente = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const contexto = `campaña #${solicitud.campana_id}, cafetería #${solicitud.cafeteria_id}`;
  const ejecutar = async accion => {
    if (!montado.current || pendiente.current) return;
    pendiente.current = true;
    setOcupado(true);
    setAviso({ texto: '', error: false });
    try {
      if (accion === 'copiar') {
        const copiado = await Clipboard.setStringAsync(solicitud.codigo);
        if (!copiado) throw new Error('portapapeles_no_disponible');
        if (montado.current) setAviso({ texto: `Código copiado: ${solicitud.codigo}`, error: false });
      } else {
        await Share.share({
          title: `Código de ${contexto}`,
          message: `Mi código de afiliado CoffeeFast: ${solicitud.codigo}\nCampaña #${solicitud.campana_id} · Cafetería #${solicitud.cafeteria_id}\nSujeto a la vigencia de la campaña y al beneficio disponible del comprador.`,
        }, { dialogTitle: 'Compartir código de CoffeeFast' });
      }
    } catch {
      if (montado.current) setAviso({
        texto: accion === 'copiar' ? 'No pudimos copiar el código. Intenta nuevamente.'
          : 'No pudimos abrir el selector para compartir. Intenta nuevamente.', error: true,
      });
    } finally {
      if (montado.current) {
        pendiente.current = false;
        setOcupado(false);
      }
    }
  };
  return <View style={styles.container}>
    {['copiar', 'compartir'].map(accion => <TouchableOpacity key={accion}
      accessibilityRole="button" accessibilityLabel={`${accion === 'copiar' ? 'Copiar' : 'Compartir'} código de ${contexto}`}
      accessibilityState={{ disabled: ocupado, busy: ocupado }} disabled={ocupado}
      onPress={() => ejecutar(accion)} style={[styles.boton, ocupado && styles.deshabilitado]}>
      <Text style={styles.botonTexto}>{accion === 'copiar' ? 'Copiar código' : 'Compartir código'}</Text>
    </TouchableOpacity>)}
    {aviso.texto ? <Text accessibilityLiveRegion="polite" accessibilityRole={aviso.error ? 'alert' : undefined}
      style={aviso.error ? styles.error : styles.texto}>{aviso.texto}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  boton: { minHeight: 48, padding: spacing.md, justifyContent: 'center', borderWidth: 1,
    borderColor: colors.cafeOscuro, borderRadius: 12, backgroundColor: colors.blanco },
  botonTexto: { color: colors.cafeOscuro, fontWeight: '700' },
  deshabilitado: { opacity: 0.5 },
  texto: { color: colors.cafeOscuro },
  error: { color: colors.rojo },
});
