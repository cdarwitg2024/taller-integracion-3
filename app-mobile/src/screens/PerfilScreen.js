import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

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
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>▣</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
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
        </View>

        <View style={styles.section}>
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
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Tus datos personales se sincronizan con tu cuenta Supabase y aparecen en esta sección.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>
            {isGuest ? 'Finalizar modo invitado' : 'Cerrar sesión'}
          </Text>
        </TouchableOpacity>
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
  profileCard: {
    backgroundColor: '#4A332C',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#4A332C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5EBE1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4A332C',
    fontFamily: 'serif',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'serif',
    marginTop: 12,
    textAlign: 'center',
  },
  email: {
    color: '#D8C9BD',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#958781',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A332C',
    maxWidth: '60%',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: '#EBE4DE',
    marginVertical: 8,
  },
  infoBanner: {
    backgroundColor: '#F5ECE5',
    borderRadius: 16,
    padding: 16,
    marginTop: 22,
  },
  infoBannerText: {
    fontSize: 11,
    color: '#7A685D',
    lineHeight: 16,
    textAlign: 'center',
  },
  logoutButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FCEAE3',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#A92A2A',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default PerfilScreen;