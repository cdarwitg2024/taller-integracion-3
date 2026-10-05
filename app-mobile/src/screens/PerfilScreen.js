import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';

const PerfilScreen = ({ session, isGuest, onLogout }) => {
  const user = session?.user;

  const fullName = user?.user_metadata?.full_name || '';
  const email = user?.email || '';
  const rol = user?.user_metadata?.rol || 'Estudiante';
  const initial = (fullName || email || 'U').trim().charAt(0).toUpperCase();

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.container}>
      <Header
        title="Mi Perfil"
        rightElement={
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>▣</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <Text style={styles.name}>
            {isGuest ? 'Invitado' : fullName || 'Estudiante'}
          </Text>
          <Text style={styles.email}>{isGuest ? 'Explorando sin cuenta' : email}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{isGuest ? 'Invitado' : rol}</Text>
          </View>
        </Card>

        <Card variant="outlined" style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la cuenta</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValue}>{isGuest ? '—' : email}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rol</Text>
            <Text style={styles.infoValue}>{isGuest ? 'Invitado' : rol}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Miembro desde</Text>
            <Text style={styles.infoValue}>
              {isGuest ? '—' : joinedDate || '—'}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sesión</Text>
            <Text style={styles.infoValue}>
              {isGuest ? 'Invitado' : 'Sincronizada con Supabase'}
            </Text>
          </View>
        </Card>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Tus datos personales se sincronizan con tu cuenta Supabase y aparecen en esta sección.
          </Text>
        </View>

        <Button
          title={isGuest ? 'Finalizar modo invitado' : 'Cerrar sesión'}
          onPress={onLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: colors.cafeOscuro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    color: colors.blanco,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 30,
  },
  profileCard: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 24,
    padding: spacing.xxl,
    alignItems: 'center',
    shadowColor: colors.cafeOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.tituloGrande,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
  },
  name: {
    color: colors.blanco,
    fontSize: typography.titulo,
    fontWeight: typography.pesoExtraBold,
    fontFamily: typography.familia,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  email: {
    color: colors.bordeOscuro,
    fontSize: typography.cuerpoPequeno,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  roleBadgeText: {
    color: colors.blanco,
    fontSize: 11,
    fontWeight: typography.pesoBold,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  infoValue: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    maxWidth: '60%',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: spacing.sm,
  },
  infoBanner: {
    backgroundColor: colors.crema,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: 22,
  },
  infoBannerText: {
    fontSize: 11,
    color: colors.textoSecundario,
    lineHeight: spacing.lg,
    textAlign: 'center',
  },
  logoutButton: {
    height: 52,
    borderRadius: 14,
    marginTop: spacing.xl,
  },
});

export default PerfilScreen;
