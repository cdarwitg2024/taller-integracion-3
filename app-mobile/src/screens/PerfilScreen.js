import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';
import Input from '../components/Input';

/**
 * Formatea un rol interno a un nombre legible en la interfaz
 */
const formatearRol = (rolRaw) => {
  if (!rolRaw) return 'Estudiante';
  const normalizado = String(rolRaw).trim().toLowerCase();
  if (normalizado === 'dueno' || normalizado === 'dueño') return 'Dueño';
  if (normalizado === 'empleado') return 'Empleado';
  if (normalizado === 'estudiante' || normalizado === 'cliente') return 'Estudiante';
  if (normalizado === 'admin' || normalizado === 'administrador') return 'Administrador';
  return normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
};

/**
 * Formatea fecha ISO a formato local legible
 */
const formatFecha = (iso) => {
  if (!iso) return '—';
  try {
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return String(iso);
    const ahora = new Date();
    const diffHoras = (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60);

    if (diffHoras < 1) return 'Hace un momento';
    if (diffHoras < 24) return `Hace ${Math.floor(diffHoras)}h`;
    if (diffHoras < 48) return 'Ayer';

    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
};

/**
 * Retorna un ícono adecuado según el tipo de acción de auditoría
 */
const getIconoMovimiento = (accion, tabla, tipoEvento) => {
  const txt = `${accion || ''} ${tabla || ''} ${tipoEvento || ''}`.toLowerCase();
  if (txt.includes('login') || txt.includes('auth') || txt.includes('sesion')) return '🔑';
  if (txt.includes('pedido') || txt.includes('orden')) return '☕';
  if (txt.includes('pago') || txt.includes('wallet') || txt.includes('saldo') || txt.includes('recarga')) return '💳';
  if (txt.includes('qr') || txt.includes('entrega') || txt.includes('retiro')) return '📦';
  if (txt.includes('update') || txt.includes('usuario') || txt.includes('perfil')) return '👤';
  if (txt.includes('delete') || txt.includes('cancel')) return '⚠️';
  return '📝';
};

/**
 * Genera una descripción amigable a partir del registro de auditoría
 */
const formatearDescripcionMovimiento = (item) => {
  if (item.metadata?.descripcion) return item.metadata.descripcion;
  if (item.metadata?.mensaje) return item.metadata.mensaje;
  if (item.descripcion) return item.descripcion;
  if (item.detalle) return typeof item.detalle === 'string' ? item.detalle : JSON.stringify(item.detalle);

  const tipo = (item.tipo_evento || '').toLowerCase();
  const tabla = (item.tabla_afectada || item.tabla || '').toLowerCase();
  const accion = (item.accion || item.action || '').toUpperCase();

  if (tipo === 'validacion_qr') return 'Validación de retiro por QR';
  if (tipo === 'cambio_estado_pedido') return 'Actualización de estado de pedido';
  if (tabla.includes('pedidos') && accion.includes('INSERT')) return 'Creación de nuevo pedido';
  if (tabla.includes('usuarios') && accion.includes('UPDATE')) return 'Actualización de datos de perfil';
  if (tabla.includes('wallet')) return 'Movimiento en billetera virtual';
  if (accion.includes('LOGIN') || tipo.includes('login')) return 'Inicio de sesión';

  if (item.tipo_evento) {
    return item.tipo_evento.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return `${accion} ${tabla ? `en ${tabla}` : ''}`.trim() || 'Actividad en cuenta';
};

const PerfilScreen = ({ session, isGuest, onLogout }) => {
  const user = session?.user;
  const authUserId = user?.id;


  // Estados de datos del usuario
  const [usuarioData, setUsuarioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [imgError, setImgError] = useState(false);

  // Estados de movimientos / logs de auditoría
  const [movimientos, setMovimientos] = useState([]);
  const [movimientosLoading, setMovimientosLoading] = useState(false);
  const [movimientosError, setMovimientosError] = useState(null);

  // Estados del modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [apellidoEdit, setApellidoEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  // ─── Carga de datos de public.usuarios ──────────────────────────────
  const cargarPerfil = useCallback(async () => {
    if (isGuest || !authUserId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setErrorCarga(null);

    try {
      // 1. Consultar public.usuarios vinculando por auth_user_id o email
      let query = supabase
        .from('usuarios')
        .select('*, roles(nombre)');

      if (authUserId) {
        query = query.or(`auth_user_id.eq.${authUserId},email.eq.${user?.email}`);
      } else if (user?.email) {
        query = query.eq('email', user.email);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Si existe registro en BD, mapeamos con prioridad BD > Auth metadata
      if (data) {
        const rolExtraido = data.roles?.nombre || data.rol || user?.user_metadata?.rol || 'estudiante';
        const info = {
          id: data.id,
          auth_user_id: data.auth_user_id || authUserId,
          nombre: data.nombre || user?.user_metadata?.first_name || '',
          apellido: data.apellido || user?.user_metadata?.last_name || '',
          correo: data.correo || data.email || user?.email || '',
          telefono: data.telefono || '',
          foto: data.foto || data.foto_url || user?.user_metadata?.avatar_url || null,
          creado_en: data.creado_en || data.created_at || user?.created_at,
          rol: rolExtraido,
        };
        setUsuarioData(info);
        cargarMovimientos(data.id, authUserId);
      } else {
        // Fallback a metadata de Supabase Auth si aún no existe en public.usuarios
        const parts = (user?.user_metadata?.full_name || '').trim().split(' ');
        const fallbackInfo = {
          id: null,
          auth_user_id: authUserId,
          nombre: user?.user_metadata?.first_name || parts[0] || '',
          apellido: user?.user_metadata?.last_name || parts.slice(1).join(' ') || '',
          correo: user?.email || '',
          telefono: user?.user_metadata?.telefono || '',
          foto: user?.user_metadata?.avatar_url || null,
          creado_en: user?.created_at,
          rol: user?.user_metadata?.rol || 'estudiante',
        };
        setUsuarioData(fallbackInfo);
        cargarMovimientos(null, authUserId);
      }
    } catch (err) {
      console.warn('Error al cargar datos de public.usuarios:', err.message);
      setErrorCarga(err.message || 'No se pudo cargar la información de tu perfil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUserId, isGuest, user]);

  // ─── Carga de movimientos desde logs_auditoria ───────────────────────
  const cargarMovimientos = async (usuarioIdInterno, authId) => {
    setMovimientosLoading(true);
    setMovimientosError(null);

    try {
      // Consultar logs_auditoria filtrando por el usuario
      let query = supabase.from('logs_auditoria').select('*');

      if (usuarioIdInterno && authId) {
        query = query.or(`usuario_id.eq.${usuarioIdInterno},auth_user_id.eq.${authId}`);
      } else if (usuarioIdInterno) {
        query = query.eq('usuario_id', usuarioIdInterno);
      } else if (authId) {
        query = query.eq('auth_user_id', authId);
      }

      // Ordenar por fecha descendente
      const { data, error } = await query
        .order('creado_en', { ascending: false })
        .limit(20);

      if (error) {
        // Puede ocurrir que la columna sea created_at
        if (error.code === '42703' && error.message?.includes('creado_en')) {
          const { data: dataRetry, error: errorRetry } = await supabase
            .from('logs_auditoria')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

          if (errorRetry) throw errorRetry;
          setMovimientos(dataRetry || []);
          return;
        }
        throw error;
      }

      setMovimientos(data || []);
    } catch (err) {
      console.warn('[PerfilScreen] Aviso al cargar logs_auditoria:', err.message);
      // Si falla por política de seguridad RLS
      if (err.code === '42501' || err.message?.includes('policy') || err.message?.includes('permission')) {
        setMovimientosError(
          'El registro de auditoría tiene acceso restringido actualmente por política de seguridad (logs_auditoria_select_dueno).'
        );
      } else {
        setMovimientosError('No se pudo sincronizar el historial de movimientos.');
      }
      setMovimientos([]);
    } finally {
      setMovimientosLoading(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarPerfil();
  };

  // ─── Inicializar modal de edición ──────────────────────────────────
  const abrirModalEdicion = () => {
    setErrorEdit('');
    setNombreEdit(usuarioData?.nombre || '');
    setApellidoEdit(usuarioData?.apellido || '');
    setTelefonoEdit(usuarioData?.telefono || '');
    setModalVisible(true);
  };

  // ─── Guardar cambios respetando política usuarios_update_own ────────
  const guardarEdicion = async () => {
    if (!nombreEdit.trim()) {
      setErrorEdit('El nombre no puede estar vacío.');
      return;
    }

    setGuardando(true);
    setErrorEdit('');

    try {
      const updates = {
        nombre: nombreEdit.trim(),
        apellido: apellidoEdit.trim(),
        telefono: telefonoEdit.trim() || null,
      };

      // Si existe id interno actualizamos por id; si no, por auth_user_id
      let updateQuery = supabase.from('usuarios').update(updates);

      if (usuarioData?.id) {
        updateQuery = updateQuery.eq('id', usuarioData.id);
      } else if (authUserId) {
        updateQuery = updateQuery.eq('auth_user_id', authUserId);
      } else {
        throw new Error('No se identificó el ID de usuario para actualizar.');
      }

      const { error } = await updateQuery;
      if (error) throw error;

      // Actualizar estado local inmediatamente
      setUsuarioData((prev) => ({
        ...prev,
        nombre: nombreEdit.trim(),
        apellido: apellidoEdit.trim(),
        telefono: telefonoEdit.trim() || '',
      }));

      // También sincronizar opcionalmente en Supabase Auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            first_name: nombreEdit.trim(),
            last_name: apellidoEdit.trim(),
            full_name: `${nombreEdit.trim()} ${apellidoEdit.trim()}`.trim(),
            telefono: telefonoEdit.trim() || null,
          },
        });
      } catch {
        // no bloqueante
      }

      setModalVisible(false);
      Alert.alert('¡Perfil actualizado!', 'Tus datos se guardaron exitosamente.');
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      setErrorEdit(
        err.message?.includes('policy')
          ? 'Error de permisos: la política usuarios_update_own no permitió la modificación.'
          : err.message || 'No se pudieron guardar los cambios.'
      );
    } finally {
      setGuardando(false);
    }
  };

  // ─── Render: Caso Invitado ─────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <ScrollView contentContainerStyle={styles.content}>
          <Card variant="elevated" style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>?</Text>
            </View>
            <Text style={styles.name}>Modo Invitado</Text>
            <Text style={styles.email}>Explorando CoffeeFaster</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Invitado</Text>
            </View>
          </Card>

          <Card variant="outlined" style={styles.section}>
            <Text style={styles.sectionTitle}>Cuenta no registrada</Text>
            <Text style={styles.emptyDescription}>
              Inicia sesión con tu correo institucional (@alu.uct.cl) para ver tu información, editar tus datos personales y consultar tu historial de actividad.
            </Text>
          </Card>

          <Button
            title="Finalizar modo invitado"
            onPress={onLogout}
            variant="primary"
            style={styles.actionButton}
          />
        </ScrollView>
      </View>
    );
  }

  // ─── Render: Caso Cargando ──────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.cafeOscuro} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </View>
    );
  }

  // ─── Render: Caso Error Crítico ─────────────────────────────────────
  if (errorCarga && !usuarioData) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Error al cargar perfil</Text>
          <Text style={styles.errorDescription}>{errorCarga}</Text>
          <Button
            title="Reintentar"
            onPress={cargarPerfil}
            variant="primary"
            style={{ marginTop: spacing.md, minWidth: 160 }}
          />
        </View>
      </View>
    );
  }

  // ─── Cálculos de datos para la vista ───────────────────────────────
  const nombreCompleto = `${usuarioData?.nombre || ''} ${usuarioData?.apellido || ''}`.trim() || 'Estudiante';
  const inicial = (
    usuarioData?.nombre?.[0]
      ? `${usuarioData.nombre[0]}${usuarioData?.apellido?.[0] || ''}`
      : usuarioData?.correo?.[0] || 'U'
  ).toUpperCase();

  const fechaMiembro = formatFecha(usuarioData?.creado_en);
  const rolLegible = formatearRol(usuarioData?.rol);

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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.cafeOscuro]}
            tintColor={colors.cafeOscuro}
          />
        }
      >
        {/* Tarjeta Superior de Perfil */}
        <Card variant="elevated" style={styles.profileCard}>
          {usuarioData?.foto && !imgError ? (
            <Image
              source={{ uri: usuarioData.foto }}
              style={styles.avatarImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{inicial}</Text>
            </View>
          )}

          <Text style={styles.name}>{nombreCompleto}</Text>
          <Text style={styles.email}>{usuarioData?.correo || 'Sin correo'}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{rolLegible}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButtonBadge}
            onPress={abrirModalEdicion}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>✏️ Editar Datos</Text>
          </TouchableOpacity>
        </Card>

        {/* Sección de Datos Personales */}
        <Card variant="outlined" style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Información de la cuenta</Text>
            <TouchableOpacity onPress={abrirModalEdicion}>
              <Text style={styles.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre</Text>
            <Text style={styles.infoValue}>{usuarioData?.nombre || '—'}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Apellido</Text>
            <Text style={styles.infoValue}>{usuarioData?.apellido || '—'}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValue}>{usuarioData?.correo || '—'}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Teléfono</Text>
            <Text style={styles.infoValue}>{usuarioData?.telefono || 'No registrado'}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rol</Text>
            <Text style={styles.infoValue}>{rolLegible}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Miembro desde</Text>
            <Text style={styles.infoValue}>{fechaMiembro}</Text>
          </View>
        </Card>

        {/* Sección: Mis Movimientos (Historial de Auditoría) */}
        <Card variant="outlined" style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Mis Movimientos</Text>
            <Text style={styles.subtitleBadge}>logs_auditoria</Text>
          </View>

          {movimientosLoading ? (
            <View style={styles.miniLoader}>
              <ActivityIndicator size="small" color={colors.cafeOscuro} />
              <Text style={styles.miniLoaderText}>Cargando actividad...</Text>
            </View>
          ) : movimientosError ? (
            <View style={styles.auditWarningBox}>
              <Text style={styles.auditWarningIcon}>ℹ️</Text>
              <Text style={styles.auditWarningText}>{movimientosError}</Text>
            </View>
          ) : movimientos.length === 0 ? (
            <View style={styles.emptyMovimientos}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Sin actividad registrada</Text>
              <Text style={styles.emptyDescription}>
                Tus acciones de pedidos, pagos y actualizaciones de cuenta se reflejarán aquí.
              </Text>
            </View>
          ) : (
            movimientos.map((item, index) => {
              const icon = getIconoMovimiento(
                item.accion,
                item.tabla_afectada || item.tabla,
                item.tipo_evento
              );
              const desc = formatearDescripcionMovimiento(item);
              const fechaMov = formatFecha(item.creado_en || item.created_at);

              return (
                <View key={item.id || index}>
                  <View style={styles.movimientoRow}>
                    <View style={styles.movimientoIconBox}>
                      <Text style={styles.movimientoIcon}>{icon}</Text>
                    </View>
                    <View style={styles.movimientoInfo}>
                      <Text style={styles.movimientoDesc} numberOfLines={2}>
                        {desc}
                      </Text>
                      <Text style={styles.movimientoFecha}>{fechaMov}</Text>
                    </View>
                  </View>
                  {index < movimientos.length - 1 && <View style={styles.separator} />}
                </View>
              );
            })
          )}
        </Card>

        {/* Banner Informativo */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            🔒 La edición de perfil se encuentra protegida por la política de seguridad RLS{' '}
            <Text style={{ fontWeight: typography.pesoBold }}>usuarios_update_own</Text>.
          </Text>
        </View>

        {/* Botón de Cerrar Sesión */}
        <Button
          title="Cerrar sesión"
          onPress={onLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Modal para Editar Nombre y Teléfono */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Puedes actualizar tu nombre, apellido y teléfono de contacto.
            </Text>

            {Boolean(errorEdit) && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{errorEdit}</Text>
              </View>
            )}

            <Input
              label="Nombre"
              placeholder="Ej. Juan"
              value={nombreEdit}
              onChangeText={setNombreEdit}
              autoCapitalize="words"
            />

            <Input
              label="Apellido"
              placeholder="Ej. Pérez"
              value={apellidoEdit}
              onChangeText={setApellidoEdit}
              autoCapitalize="words"
            />

            <Input
              label="Teléfono"
              placeholder="+56 9 1234 5678"
              value={telefonoEdit}
              onChangeText={setTelefonoEdit}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setModalVisible(false)}
                disabled={guardando}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title={guardando ? 'Guardando...' : 'Guardar'}
                variant="primary"
                onPress={guardarEdicion}
                disabled={guardando}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textoSecundario,
    fontSize: typography.cuerpo,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: spacing.xs,
  },
  errorDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.cafeOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.blanco,
    backgroundColor: colors.crema,
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
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
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
  editButtonBadge: {
    marginTop: spacing.md,
    backgroundColor: colors.blanco,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
  },
  editButtonText: {
    color: colors.cafeOscuro,
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
  },
  section: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  editLink: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeMedio,
  },
  subtitleBadge: {
    fontSize: 10,
    color: colors.textoDeshabilitado,
    backgroundColor: colors.fondo,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontFamily: typography.familia,
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
    maxWidth: '65%',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: spacing.sm,
  },
  miniLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  miniLoaderText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },
  auditWarningBox: {
    backgroundColor: colors.doradoBg,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  auditWarningIcon: {
    fontSize: 18,
  },
  auditWarningText: {
    flex: 1,
    fontSize: 11,
    color: colors.naranja,
    lineHeight: 16,
  },
  emptyMovimientos: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  movimientoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  movimientoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  movimientoIcon: {
    fontSize: 18,
  },
  movimientoInfo: {
    flex: 1,
  },
  movimientoDesc: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.textoPrimario,
    marginBottom: 2,
  },
  movimientoFecha: {
    fontSize: 11,
    color: colors.textoSecundario,
  },
  infoBanner: {
    backgroundColor: colors.crema,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: 18,
  },
  infoBannerText: {
    fontSize: 11,
    color: colors.textoSecundario,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.xl,
  },
  logoutButton: {
    height: 50,
    borderRadius: 14,
    marginTop: spacing.xl,
  },
  // ─── Modal de Edición ──────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textoSecundario,
    fontWeight: typography.pesoBold,
  },
  modalSubtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginBottom: spacing.lg,
  },
  modalErrorBox: {
    backgroundColor: colors.rojoBg,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalErrorText: {
    color: colors.rojo,
    fontSize: typography.cuerpoPequeno,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
});

export default PerfilScreen;

