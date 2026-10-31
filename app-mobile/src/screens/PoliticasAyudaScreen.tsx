import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type PoliticasAyudaSeccion =
  | 'todas'
  | 'cancelacion'
  | 'reembolso'
  | 'preparacion'
  | 'retiro_qr'
  | 'faq'
  | 'contacto';

interface PoliticasAyudaScreenProps {
  onBack: () => void;
  seccionInicial?: PoliticasAyudaSeccion;
}

interface FaqItem {
  id: string;
  pregunta: string;
  respuesta: string;
  icono: string;
  categoria: 'pedidos' | 'wallet' | 'retiro' | 'sistema';
}

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    pregunta: '¿Cuándo puedo cancelar un pedido?',
    respuesta:
      'Solamente puedes cancelar tu pedido mientras se encuentre en estado "Pendiente" (orden confirmada y pagada, antes de que el personal de cocina inicie su elaboración). Si ya está "En preparación", "Listo" o "Entregado", no podrá cancelarse porque los insumos ya fueron procesados.',
    icono: '⏱️',
    categoria: 'pedidos',
  },
  {
    id: 'faq-2',
    pregunta: '¿Cómo funciona el reembolso a mi Wallet?',
    respuesta:
      'Al cancelar con éxito un pedido pendiente, o si la cafetería no puede prepararlo por falta de stock imprevista, el 100% del dinero pagado se reembolsa automáticamente a tu Billetera Virtual (Wallet). El abono es inmediato, sin comisiones y se refleja en tus movimientos como "+$Saldo".',
    icono: '💰',
    categoria: 'wallet',
  },
  {
    id: 'faq-3',
    pregunta: '¿Cómo retiro mi pedido en la cafetería?',
    respuesta:
      'Dirígete a la pestaña "Pedidos" y selecciona tu orden activa. Se desplegará tu Código QR digital encriptado y un código de retiro alfanumérico. Acércate al mesón de entrega de la cafetería de tu campus y muéstralo al personal para recibir tus productos.',
    icono: '📱',
    categoria: 'retiro',
  },
  {
    id: 'faq-4',
    pregunta: '¿Qué ocurre con la franja horaria de preparación?',
    respuesta:
      'Al pagar tu pedido, se te asigna una franja de retiro (por ejemplo, 15 a 20 minutos). Te recomendamos acudir puntualmente al mesón de retiro para disfrutar de tus bebidas y alimentos a temperatura y frescura óptima.',
    icono: '☕',
    categoria: 'pedidos',
  },
  {
    id: 'faq-5',
    pregunta: '¿Puedo pedir productos de cafeterías distintas en la misma orden?',
    respuesta:
      'No. Cada pedido se prepara en una cafetería específica para asegurar la disponibilidad física y la trazabilidad de inventario. Si agregas productos de una cafetería diferente, la aplicación te consultará si deseas vaciar el carrito actual.',
    icono: '🏪',
    categoria: 'pedidos',
  },
  {
    id: 'faq-6',
    pregunta: '¿Cómo recargo saldo en mi Billetera Virtual?',
    respuesta:
      'Accede a la pestaña "Wallet" en la barra inferior o desde el acceso rápido en tu perfil. Selecciona uno de los montos sugeridos ($2.000, $5.000, $10.000, etc.) o ingresa el saldo deseado y confirma la recarga para usarlo en tus compras.',
    icono: '💳',
    categoria: 'wallet',
  },
  {
    id: 'faq-7',
    pregunta: '¿Qué hago si la pantalla de pago tarda o falla la conexión?',
    respuesta:
      'Si pierdes conexión al presionar pagar, no intentes pagar nuevamente de inmediato. Tu carrito se conservará intacto. Revisa primero la pestaña "Pedidos" para verificar si la orden alcanzó a confirmarse; así evitarás débitos duplicados.',
    icono: '📶',
    categoria: 'sistema',
  },
  {
    id: 'faq-8',
    pregunta: '¿Qué pasa si el lector no puede leer mi código QR?',
    respuesta:
      'No te preocupes. Debajo de cada Código QR dispones de un código de retiro alfanumérico único (por ejemplo: CF-8421). El personal de mesón puede digitar ese código en el sistema de escritorio para validar y entregar tu pedido.',
    icono: '🔢',
    categoria: 'retiro',
  },
];

export const PoliticasAyudaScreen: React.FC<PoliticasAyudaScreenProps> = ({
  onBack,
  seccionInicial = 'todas',
}) => {
  // Manejo de pestaña activa: 'politicas' o 'ayuda'
  const [tabActiva, setTabActiva] = useState<'politicas' | 'ayuda'>(
    seccionInicial === 'faq' || seccionInicial === 'contacto' ? 'ayuda' : 'politicas'
  );

  // Acordeón de FAQs abiertas
  const [faqsAbiertas, setFaqsAbiertas] = useState<{ [id: string]: boolean }>({
    'faq-1': true,
    'faq-2': true,
  });

  // Suscripción al botón físico Atrás de Android
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  const toggleFaq = (id: string) => {
    setFaqsAbiertas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <View style={styles.container}>
      <Header title="Políticas y Ayuda" onBack={onBack} rightElement={undefined} />

      {/* Selector de Pestañas Principales */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tabActiva === 'politicas' && styles.tabButtonActive]}
          onPress={() => setTabActiva('politicas')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabEmoji}>📜</Text>
          <Text
            style={[styles.tabButtonText, tabActiva === 'politicas' && styles.tabButtonTextActive]}
          >
            Reglas y Políticas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, tabActiva === 'ayuda' && styles.tabButtonActive]}
          onPress={() => setTabActiva('ayuda')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabEmoji}>💬</Text>
          <Text
            style={[styles.tabButtonText, tabActiva === 'ayuda' && styles.tabButtonTextActive]}
          >
            Centro de Ayuda
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tabActiva === 'politicas' ? (
          <>
            {/* Banner Introductorio */}
            <Card variant="elevated" style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroEmoji}>☕</Text>
                <View style={styles.heroTexts}>
                  <Text style={styles.heroTitle}>Políticas de Servicio CoffeeFast</Text>
                  <Text style={styles.heroSubtitle}>
                    Universidad Católica de Temuco — Campus San Juan Pablo II & Campus San Francisco
                  </Text>
                </View>
              </View>
              <Text style={styles.heroDescription}>
                Conoce las condiciones operativas, reglas de compra anticipada, cancelación,
                reembolso de saldo y validación de entrega segura en nuestras cafeterías.
              </Text>
            </Card>

            {/* 1. REGLAS DE CANCELACIÓN Y REEMBOLSO */}
            <Card variant="outlined" style={styles.policyCard}>
              <View style={styles.policyHeaderRow}>
                <View style={styles.policyIconBadge}>
                  <Text style={styles.policyIconText}>↩️</Text>
                </View>
                <View style={styles.policyHeaderContent}>
                  <Text style={styles.policyTitle}>Cancelación y Reembolso</Text>
                  <Text style={styles.policySubtitle}>
                    Regla transaccional y protección de saldo Wallet
                  </Text>
                </View>
              </View>

              <View style={styles.ruleItem}>
                <View style={styles.ruleBadgeSuccess}>
                  <Text style={styles.ruleBadgeSuccessText}>PERMITIDO</Text>
                </View>
                <Text style={styles.ruleTitle}>Cancelación en estado "Pendiente"</Text>
                <Text style={styles.ruleDescription}>
                  Puedes cancelar tu pedido de forma autónoma únicamente mientras permanezca en
                  estado <Text style={styles.bold}>Pendiente</Text> (orden pagada antes del inicio
                  de su preparación en cocina).
                </Text>
              </View>

              <View style={styles.ruleItem}>
                <View style={styles.ruleBadgeDanger}>
                  <Text style={styles.ruleBadgeDangerText}>NO REVERSIBLE</Text>
                </View>
                <Text style={styles.ruleTitle}>Pedidos en preparación o listos</Text>
                <Text style={styles.ruleDescription}>
                  Una vez que el personal de cocina cambia el pedido a{' '}
                  <Text style={styles.bold}>En preparación</Text>,{' '}
                  <Text style={styles.bold}>Listo</Text> o{' '}
                  <Text style={styles.bold}>Entregado</Text>, los insumos ya fueron procesados y no
                  se admite cancelación ni devolución manual.
                </Text>
              </View>

              <View style={styles.ruleItem}>
                <View style={styles.ruleBadgeInfo}>
                  <Text style={styles.ruleBadgeInfoText}>AUTOMÁTICO</Text>
                </View>
                <Text style={styles.ruleTitle}>Reembolso inmediato a Wallet</Text>
                <Text style={styles.ruleDescription}>
                  Toda cancelación válida reintegra el <Text style={styles.bold}>100%</Text> del
                  monto pagado a tu saldo disponible en Wallet al instante, sin comisiones bancarias
                  ni tiempos de espera. Se registra como movimiento tipo{' '}
                  <Text style={styles.bold}>reembolso</Text> con verificación de idempotencia
                  transaccional.
                </Text>
              </View>
            </Card>

            {/* 2. PREPARACIÓN EN CAFETERÍA */}
            <Card variant="outlined" style={styles.policyCard}>
              <View style={styles.policyHeaderRow}>
                <View style={[styles.policyIconBadge, { backgroundColor: colors.doradoBg }]}>
                  <Text style={styles.policyIconText}>⏱️</Text>
                </View>
                <View style={styles.policyHeaderContent}>
                  <Text style={styles.policyTitle}>Preparación y Franjas Horarias</Text>
                  <Text style={styles.policySubtitle}>
                    Tiempos de comanda y frescura de los alimentos
                  </Text>
                </View>
              </View>

              <View style={styles.stepFlowRow}>
                <View style={styles.stepChip}>
                  <Text style={styles.stepChipNum}>1</Text>
                  <Text style={styles.stepChipText}>Pendiente</Text>
                </View>
                <Text style={styles.stepArrow}>➔</Text>
                <View style={styles.stepChip}>
                  <Text style={styles.stepChipNum}>2</Text>
                  <Text style={styles.stepChipText}>En cocina</Text>
                </View>
                <Text style={styles.stepArrow}>➔</Text>
                <View style={styles.stepChip}>
                  <Text style={styles.stepChipNum}>3</Text>
                  <Text style={styles.stepChipText}>Listo</Text>
                </View>
                <Text style={styles.stepArrow}>➔</Text>
                <View style={[styles.stepChip, { backgroundColor: colors.verdeBg }]}>
                  <Text style={[styles.stepChipNum, { color: colors.verde }]}>✓</Text>
                  <Text style={[styles.stepChipText, { color: colors.verde }]}>Retirado</Text>
                </View>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Asignación de Franja Horaria:</Text> Al realizar el
                  pago, la app te asigna un tiempo estimado de entrega (ej. 15 a 20 minutos)
                  calculado según la demanda de la cafetería.
                </Text>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Exclusividad de Cafetería:</Text> Cada pedido pertenece
                  únicamente a una cafetería específica. No es posible mezclar ítems ni retirar
                  productos en un campus diferente al seleccionado.
                </Text>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Puntualidad de Retiro:</Text> Para garantizar que tu
                  café, sándwich o preparación caliente mantenga la calidad óptima, te sugerimos
                  acercarte al mesón en cuanto la app notifique que tu pedido está{' '}
                  <Text style={styles.bold}>Listo</Text>.
                </Text>
              </View>
            </Card>

            {/* 3. RETIRO MEDIANTE CÓDIGO QR */}
            <Card variant="outlined" style={styles.policyCard}>
              <View style={styles.policyHeaderRow}>
                <View style={[styles.policyIconBadge, { backgroundColor: colors.verdeBg }]}>
                  <Text style={styles.policyIconText}>📦</Text>
                </View>
                <View style={styles.policyHeaderContent}>
                  <Text style={styles.policyTitle}>Retiro mediante Código QR</Text>
                  <Text style={styles.policySubtitle}>
                    Entrega segura y validación en mesón institucional
                  </Text>
                </View>
              </View>

              <View style={styles.qrHighlightBox}>
                <Text style={styles.qrHighlightEmoji}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrHighlightTitle}>Credencial QR Dinámica</Text>
                  <Text style={styles.qrHighlightText}>
                    Cada pedido aprobado cuenta con un token encriptado único emitido por el
                    servidor de pedidos (<Text style={styles.bold}>ms-pedidos</Text>) para asegurar
                    que nadie más retire tus productos.
                  </Text>
                </View>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Presentación en Mesón:</Text> Abre la pestaña{' '}
                  <Text style={styles.bold}>Pedidos</Text>, pulsa tu orden activa y muestra el QR al
                  lector óptico del personal de mesón.
                </Text>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Código de Contingencia / Offline:</Text> Si el escáner
                  presenta fallas o estás en una zona con baja cobertura Wi-Fi en el campus, puedes
                  dictar el código de retiro alfanumérico visible bajo el QR.
                </Text>
              </View>

              <View style={styles.infoBullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.bold}>Cierre de Comanda:</Text> Al escanearse el QR, el sistema
                  KDS registra la orden como <Text style={styles.bold}>Entregada</Text>, cerrando el
                  ciclo operacional e impidiendo cualquier doble retiro.
                </Text>
              </View>
            </Card>

            {/* 4. TÉRMINOS Y PRIVACIDAD RLS */}
            <Card variant="outlined" style={styles.policyCard}>
              <View style={styles.policyHeaderRow}>
                <View style={[styles.policyIconBadge, { backgroundColor: colors.naranjaBg }]}>
                  <Text style={styles.policyIconText}>🔒</Text>
                </View>
                <View style={styles.policyHeaderContent}>
                  <Text style={styles.policyTitle}>Seguridad y Privacidad de Datos</Text>
                  <Text style={styles.policySubtitle}>
                    Protección bajo directivas de base de datos RLS
                  </Text>
                </View>
              </View>

              <Text style={styles.bodyText}>
                Tu información institucional (@alu.uct.cl) y saldos en Wallet están resguardados por
                políticas de seguridad estrictas a nivel de base de datos (<Text style={styles.bold}>Row Level Security</Text>).
                CoffeeFast no comparte datos con terceros y tus transacciones de saldo quedan
                trazadas en logs de auditoría inmutables.
              </Text>
            </Card>
          </>
        ) : (
          <>
            {/* CENTRO DE AYUDA Y FAQ */}
            <Card variant="elevated" style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroEmoji}>💡</Text>
                <View style={styles.heroTexts}>
                  <Text style={styles.heroTitle}>Centro de Ayuda y Preguntas</Text>
                  <Text style={styles.heroSubtitle}>
                    Respuestas rápidas a las consultas más frecuentes de estudiantes
                  </Text>
                </View>
              </View>
              <Text style={styles.heroDescription}>
                Pulsa cualquier pregunta para desplegar la respuesta detallada o revisa los canales
                de soporte oficiales más abajo.
              </Text>
            </Card>

            {/* Lista de FAQs */}
            <Card variant="outlined" style={styles.faqContainerCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderEmoji}>❓</Text>
                <Text style={styles.sectionTitle}>Preguntas Frecuentes (FAQ)</Text>
              </View>

              {FAQS.map((item, index) => {
                const isOpen = Boolean(faqsAbiertas[item.id]);
                return (
                  <View key={item.id}>
                    <TouchableOpacity
                      style={styles.faqItemHeader}
                      onPress={() => toggleFaq(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.faqIconBox}>
                        <Text style={styles.faqIconText}>{item.icono}</Text>
                      </View>
                      <Text style={styles.faqQuestionText}>{item.pregunta}</Text>
                      <Text style={[styles.faqChevron, isOpen && styles.faqChevronOpen]}>
                        {isOpen ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.faqAnswerBox}>
                        <Text style={styles.faqAnswerText}>{item.respuesta}</Text>
                      </View>
                    )}

                    {index < FAQS.length - 1 && <View style={styles.faqSeparator} />}
                  </View>
                );
              })}
            </Card>

            {/* CANALES DE CONTACTO Y SOPORTE */}
            <Card variant="outlined" style={styles.policyCard}>
              <View style={styles.policyHeaderRow}>
                <View style={[styles.policyIconBadge, { backgroundColor: colors.crema }]}>
                  <Text style={styles.policyIconText}>✉️</Text>
                </View>
                <View style={styles.policyHeaderContent}>
                  <Text style={styles.policyTitle}>Canales de Contacto y Soporte</Text>
                  <Text style={styles.policySubtitle}>
                    Atención al estudiante de la Universidad Católica de Temuco
                  </Text>
                </View>
              </View>

              <Text style={styles.bodyText}>
                Si experimentas discrepancias con tu saldo en Wallet, pedidos no validados en mesón o
                requieres asistencia con tu cuenta institucional, contáctanos:
              </Text>

              <View style={styles.contactItemBox}>
                <Text style={styles.contactLabel}>📧 Correo de soporte:</Text>
                <Text style={styles.contactValue}>soporte.cafeteria@alu.uct.cl</Text>
              </View>

              <View style={styles.contactItemBox}>
                <Text style={styles.contactLabel}>⏰ Horario de atención:</Text>
                <Text style={styles.contactValue}>Lunes a Viernes: 08:30 a 18:30 hrs</Text>
              </View>

              <View style={styles.contactItemBox}>
                <Text style={styles.contactLabel}>📍 Campus y Sedes:</Text>
                <Text style={styles.contactValue}>
                  • Campus San Juan Pablo II (Rudecindo Ortega 02950){'\n'}
                  • Campus San Francisco (Manuel Montt 056)
                </Text>
              </View>

              <View style={styles.supportTipCard}>
                <Text style={styles.supportTipIcon}>💡</Text>
                <Text style={styles.supportTipText}>
                  Para una atención más expedita al reportar un problema de pedido, indica siempre tu
                  código de orden (ej. #124) y correo institucional.
                </Text>
              </View>
            </Card>
          </>
        )}

        {/* Botón de cierre o regreso al final */}
        <Button
          title="Entendido y volver al perfil"
          variant="primary"
          onPress={onBack}
          style={styles.backBottomButton}
        />
      </ScrollView>
    </View>
  );
};

export default PoliticasAyudaScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.blanco,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    backgroundColor: colors.fondo,
    borderWidth: 1,
    borderColor: colors.borde,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.cafeOscuro,
    borderColor: colors.cafeOscuro,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabButtonText: {
    fontSize: typography.cuerpo,
    color: colors.textoSecundario,
    fontWeight: typography.pesoMedio,
  },
  tabButtonTextActive: {
    color: colors.textoBlanco,
    fontWeight: typography.pesoBold,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  heroCard: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  heroEmoji: {
    fontSize: 32,
  },
  heroTexts: {
    flex: 1,
  },
  heroTitle: {
    fontSize: typography.subtitulo,
    color: colors.textoBlanco,
    fontWeight: typography.pesoBold,
  },
  heroSubtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.dorado,
    marginTop: 2,
  },
  heroDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.crema,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  policyCard: {
    marginBottom: spacing.lg,
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.blanco,
  },
  policyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  policyIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.rojoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyIconText: {
    fontSize: 22,
  },
  policyHeaderContent: {
    flex: 1,
  },
  policyTitle: {
    fontSize: typography.subtitulo,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoBold,
  },
  policySubtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginTop: 2,
  },
  ruleItem: {
    backgroundColor: colors.fondo,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  ruleBadgeSuccess: {
    alignSelf: 'flex-start',
    backgroundColor: colors.verdeBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  ruleBadgeSuccessText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
    color: colors.verde,
  },
  ruleBadgeDanger: {
    alignSelf: 'flex-start',
    backgroundColor: colors.rojoBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  ruleBadgeDangerText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
    color: colors.rojo,
  },
  ruleBadgeInfo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.doradoBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  ruleBadgeInfoText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
    color: colors.naranja,
  },
  ruleTitle: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: 4,
  },
  ruleDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
  },
  stepFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.fondo,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  stepChip: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.blanco,
    minWidth: 54,
  },
  stepChipNum: {
    fontSize: 10,
    fontWeight: typography.pesoBold,
    color: colors.cafeMedio,
  },
  stepChipText: {
    fontSize: 9,
    fontWeight: typography.pesoMedio,
    color: colors.textoPrimario,
    marginTop: 2,
  },
  stepArrow: {
    fontSize: 10,
    color: colors.cafeClaro,
  },
  infoBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  bulletDot: {
    fontSize: 16,
    color: colors.cafeMedio,
    marginRight: spacing.sm,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 19,
  },
  bold: {
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  bodyText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  qrHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.doradoBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  qrHighlightEmoji: {
    fontSize: 28,
  },
  qrHighlightTitle: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: 2,
  },
  qrHighlightText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 17,
  },
  faqContainerCard: {
    marginBottom: spacing.lg,
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.blanco,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionHeaderEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: typography.subtitulo,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoBold,
  },
  faqItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  faqIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqIconText: {
    fontSize: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: typography.cuerpo,
    color: colors.cafeOscuro,
    fontWeight: typography.pesoMedio,
    lineHeight: 18,
  },
  faqChevron: {
    fontSize: 11,
    color: colors.cafeClaro,
  },
  faqChevronOpen: {
    color: colors.cafeOscuro,
  },
  faqAnswerBox: {
    backgroundColor: colors.fondo,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.dorado,
  },
  faqAnswerText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 20,
  },
  faqSeparator: {
    height: 1,
    backgroundColor: colors.borde,
  },
  contactItemBox: {
    backgroundColor: colors.fondo,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  contactLabel: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
  },
  supportTipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.verdeBg,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  supportTipIcon: {
    fontSize: 18,
  },
  supportTipText: {
    flex: 1,
    fontSize: typography.etiqueta + 1,
    color: colors.verde,
    lineHeight: 16,
    fontWeight: typography.pesoMedio,
  },
  backBottomButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
