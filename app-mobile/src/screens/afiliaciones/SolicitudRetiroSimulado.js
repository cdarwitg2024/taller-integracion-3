import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { DESTINO_RETIRO_SIMULADO, validarMontoRetiroSimulado } from '../../utils/retiroSimulado';
import { confirmarRetiroSimulado, consultarIntentoRetiro, prepararOtroRetiro } from '../../services/confirmarRetiroSimulado';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function SolicitudRetiroSimulado({ disponible, confirmado, usuarioId, onConfirmado, onAccesoDenegado, onVerHistorial }) {
  const [monto, setMonto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [intento, setIntento] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(Boolean(usuarioId));
  const [bloqueado, setBloqueado] = useState(false);
  const enviando = useRef(false);
  const vigente = useRef(false);
  const actual = confirmado && resultado?.saldo === disponible && resultado?.texto === monto ? resultado : null;
  const comprobante = intento?.comprobante;
  const pendiente = intento && !comprobante;
  useEffect(() => {
    vigente.current = true;
    if (usuarioId) consultarIntentoRetiro(usuarioId).then(guardado => {
      if (!vigente.current) return;
      setIntento(guardado);
      if (guardado) setMonto(String(guardado.monto));
    }).catch(e => { if (vigente.current) { setError(e.message); setBloqueado(true); } })
      .finally(() => { if (vigente.current) setOcupado(false); });
    return () => { vigente.current = false; };
  }, [usuarioId]);
  const revisar = () => {
    if (!confirmado || ocupado || enviando.current || intento || bloqueado) return;
    setError('');
    setResultado({ ...validarMontoRetiroSimulado(monto, disponible), texto: monto, saldo: disponible });
  };
  const enviar = async () => {
    if (enviando.current || ocupado || bloqueado || !usuarioId || comprobante || (!pendiente && !actual?.monto)) return;
    enviando.current = true; setOcupado(true); setError('');
    try {
      const recibo = await confirmarRetiroSimulado(usuarioId, pendiente ? intento.monto : actual.monto);
      if (vigente.current) {
        setIntento({ monto: recibo.monto_clp, comprobante: recibo });
        setResultado(null);
        onConfirmado?.(recibo);
      }
    } catch (e) {
      if (!vigente.current) return;
      if ([401, 403].includes(e.status)) {
        setBloqueado(true);
        setError(e.status === 403 ? 'Tu cuenta no tiene permisos para retirar.' : 'Tu sesión venció. Vuelve a iniciar sesión.');
        onAccesoDenegado?.(e.status);
      } else {
        try { const guardado = await consultarIntentoRetiro(usuarioId); if (vigente.current) setIntento(guardado); }
        catch (lectura) { if (vigente.current) { setBloqueado(true); setError(lectura.message); } return; }
        if (vigente.current) setError(e.status === 422 ? 'El servidor rechazó el monto. Actualiza el saldo y revisa la solicitud.'
          : 'No pudimos confirmar el retiro. Recupera la misma solicitud antes de preparar otra.');
      }
    } finally {
      enviando.current = false;
      if (vigente.current) setOcupado(false);
    }
  };
  const otro = async () => {
    if (enviando.current || ocupado || !comprobante) return;
    enviando.current = true; setOcupado(true);
    try {
      await prepararOtroRetiro(usuarioId);
      if (vigente.current) { setIntento(null); setMonto(''); setResultado(null); setError(''); }
    } catch (e) { if (vigente.current) setError(e.message); }
    finally { enviando.current = false; if (vigente.current) setOcupado(false); }
  };
  const deshabilitado = !confirmado || ocupado || Boolean(intento) || bloqueado;
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.titulo}>Preparar retiro simulado</Text>
    <Text style={styles.texto}>Esta operación es simulada: no realiza una transferencia bancaria. Confirmar registra un retiro y descuenta tu saldo disponible de comisiones.</Text>
    <Text style={styles.texto}>{`Destino ficticio: ${DESTINO_RETIRO_SIMULADO}`}</Text>
    <Text style={styles.texto}>El monto se valida únicamente contra tu saldo disponible, sin incluir comisiones pendientes.</Text>
    {!confirmado && <Text accessibilityLiveRegion="polite" style={styles.texto}>Actualiza el saldo para habilitar la preparación del retiro.</Text>}
    <TextInput accessibilityLabel="Monto del retiro simulado en pesos chilenos"
      value={monto} onChangeText={valor => { if (!deshabilitado) { setMonto(valor); setResultado(null); setError(''); } }}
      editable={!deshabilitado} keyboardType="number-pad" placeholder="Monto en CLP, sin puntos ni comas" style={styles.input} />
    {actual?.error ? <Text accessibilityRole="alert" style={styles.error}>{actual.error}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {ocupado && <ActivityIndicator accessibilityLabel="Procesando retiro simulado" />}
    {!intento && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Revisar solicitud de retiro simulado"
      accessibilityState={{ disabled: deshabilitado }} disabled={deshabilitado} onPress={revisar} style={styles.boton}>
      <Text style={styles.botonTexto}>Revisar solicitud simulada</Text>
    </TouchableOpacity>}
    {actual?.monto && !intento ? <View accessibilityLiveRegion="polite" style={styles.resumen}>
      <Text style={styles.titulo}>{`Monto válido para revisar: $${actual.monto.toLocaleString('es-CL')}`}</Text>
      <Text style={styles.texto}>{`Destino: ${DESTINO_RETIRO_SIMULADO}`}</Text>
      <Text style={styles.texto}>La solicitud simulada todavía no se ha enviado. Tu saldo no ha cambiado.</Text>
    </View> : null}
    {!comprobante && !bloqueado && (pendiente || actual?.monto) && <>
      {pendiente && <Text style={styles.texto}>{`Retiro por recuperar: $${intento.monto.toLocaleString('es-CL')}. Se reutilizará la misma solicitud.`}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={pendiente ? 'Recuperar retiro simulado' : 'Confirmar retiro simulado'}
        disabled={ocupado || !usuarioId || (!pendiente && !confirmado)}
        accessibilityState={{ disabled: ocupado || !usuarioId || (!pendiente && !confirmado), busy: ocupado }}
        onPress={enviar} style={styles.boton}>
        <Text style={styles.botonTexto}>{pendiente ? 'Recuperar retiro' : 'Confirmar retiro simulado'}</Text>
      </TouchableOpacity>
    </>}
    {comprobante && <View accessibilityLiveRegion="polite" style={styles.resumen}>
      <Text accessibilityRole="header" style={styles.titulo}>Retiro simulado confirmado</Text>
      <Text style={styles.texto}>{`Monto: $${comprobante.monto_clp.toLocaleString('es-CL')}`}</Text>
      <Text style={styles.texto}>{`Estado: ${comprobante.estado}`}</Text>
      <Text selectable style={styles.texto}>{`Referencia del comprobante: ${comprobante.referencia}`}</Text>
      <Text style={styles.texto}>{`Destino: ${comprobante.destino}`}</Text>
      <Text style={styles.texto}>{`Saldo disponible al confirmar: $${comprobante.disponible_clp.toLocaleString('es-CL')}`}</Text>
      {onVerHistorial && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver retiro en historial"
        onPress={() => onVerHistorial(comprobante.referencia)} style={styles.boton}>
        <Text style={styles.botonTexto}>Ver retiro en historial</Text>
      </TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Preparar otro retiro simulado" disabled={ocupado}
        accessibilityState={{ disabled: ocupado }} onPress={otro} style={styles.boton}>
        <Text style={styles.botonTexto}>Preparar otro retiro simulado</Text>
      </TouchableOpacity>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, gap: spacing.sm }, titulo: { color: colors.cafeOscuro, fontWeight: '700' },
  texto: { color: colors.textoSecundario, lineHeight: 22 }, error: { color: colors.rojo },
  input: { padding: spacing.md, borderWidth: 1, borderColor: colors.cafeOscuro, borderRadius: 10, color: colors.cafeOscuro, backgroundColor: colors.blanco },
  boton: { minHeight: 48, justifyContent: 'center', padding: spacing.md, borderRadius: 10, backgroundColor: colors.cafeOscuro },
  botonTexto: { color: colors.blanco, fontWeight: '700' }, resumen: { gap: spacing.sm },
});
