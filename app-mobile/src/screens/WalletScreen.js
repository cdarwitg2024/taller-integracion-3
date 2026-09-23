import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const movements = [
  {
    id: 1,
    name: 'Café Latte Vainilla',
    cafeteria: 'Cafetería Central',
    amount: -2400,
    date: 'Hoy',
    type: 'compra',
  },
  {
    id: 2,
    name: 'Recarga de saldo',
    cafeteria: 'Wallet CoffeeFast',
    amount: 10000,
    date: 'Ayer',
    type: 'recarga',
  },
];

const WalletScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <Text style={styles.headerTitle}>Mi Wallet</Text>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>▣</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tarjeta de saldo */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO DISPONIBLE</Text>
          <Text style={styles.balanceValue}>$7.600</Text>
          <Text style={styles.balanceHint}>
            Listo para tus próximos pedidos en el campus
          </Text>

          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.balanceButton}>
              <Text style={styles.balanceButtonText}>Recargar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.balanceButton, styles.balanceButtonGhost]}>
              <Text style={styles.balanceButtonGhostText}>Tickets</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Métodos de pago */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Métodos de pago</Text>

          <View style={styles.paymentCard}>
            <View style={styles.paymentBullet} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Tarjeta Caducidad</Text>
              <Text style={styles.paymentSub}>Visa •••• 4821</Text>
            </View>
            <Text style={styles.paymentCheck}>✓</Text>
          </View>

          <View style={styles.paymentCard}>
            <View style={[styles.paymentBullet, styles.paymentBulletAlt]} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Saldo Estudiante</Text>
              <Text style={styles.paymentSub}>Tarjeta UCT</Text>
            </View>
            <Text style={styles.paymentCheck}>✓</Text>
          </View>
        </View>

        {/* Últimos movimientos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos movimientos</Text>

          {movements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>Sin movimientos todavía</Text>
              <Text style={styles.emptyDescription}>
                Tus cargas y compras aparecerán aquí para que lleves el control de tu saldo.
              </Text>
            </View>
          ) : (
            movements.map((m) => (
              <View key={m.id} style={styles.movementCard}>
                <View
                  style={[
                    styles.movementIcon,
                    m.type === 'recarga' ? styles.movementIconIn : styles.movementIconOut,
                  ]}
                >
                  <Text style={styles.movementIconText}>
                    {m.type === 'recarga' ? '+' : '−'}
                  </Text>
                </View>

                <View style={styles.movementInfo}>
                  <Text style={styles.movementName}>{m.name}</Text>
                  <Text style={styles.movementMeta}>
                    {m.cafeteria} • {m.date}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.movementAmount,
                    m.amount < 0 ? styles.movementAmountOut : styles.movementAmountIn,
                  ]}
                >
                  {m.amount < 0 ? '−' : '+'}${Math.abs(m.amount).toLocaleString('es-CL')}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.footerText}>
            Las recargas y movimientos se sincronizan con tu cuenta Supabase.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },
  header: {
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A332C',
  },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: '#4A332C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  balanceCard: {
    backgroundColor: '#4A332C',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#4A332C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceLabel: {
    color: '#D8C9BD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    fontFamily: 'serif',
    marginTop: 6,
  },
  balanceHint: {
    color: '#D8C9BD',
    fontSize: 12,
    marginTop: 4,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  balanceButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5EBE1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceButtonText: {
    color: '#4A332C',
    fontSize: 13,
    fontWeight: '700',
  },
  balanceButtonGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  balanceButtonGhostText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A332C',
    marginBottom: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  paymentBullet: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCEAE3',
    borderWidth: 1,
    borderColor: '#E8C4B4',
  },
  paymentBulletAlt: {
    backgroundColor: '#E8F3E4',
    borderColor: '#BFD9B8',
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A332C',
  },
  paymentSub: {
    fontSize: 11,
    color: '#958781',
    marginTop: 2,
  },
  paymentCheck: {
    fontSize: 14,
    color: '#5B8C51',
    fontWeight: '800',
  },
  movementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  movementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementIconIn: {
    backgroundColor: '#E8F3E4',
  },
  movementIconOut: {
    backgroundColor: '#FCEAE3',
  },
  movementIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A332C',
  },
  movementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  movementName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A332C',
  },
  movementMeta: {
    fontSize: 10,
    color: '#958781',
    marginTop: 2,
  },
  movementAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  movementAmountIn: {
    color: '#5B8C51',
  },
  movementAmountOut: {
    color: '#4A332C',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: '#F9F3EC',
    borderRadius: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A332C',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 12,
    color: '#958781',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#A09590',
    marginTop: 8,
  },
});

export default WalletScreen;