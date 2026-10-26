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
  if (normalizado === 'empleado') return 'Personal Cafetería';
  if (normalizado === 'estudiante' || normalizado === 'cliente') return 'Estudiante';
  if (normalizado === 'admin' || normalizado === 'administrador') return 'Administrador';
  return normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
};

/**
 * Formatea valores numéricos a pesos chilenos (CLP)
 */
const formatCLP = (monto) => {
  const num = Math.round(Number(monto) || 0);
  return `$${num.toLocaleString('es-CL')}`;
};

/**
 * Formatea fecha ISO a formato relativo o local amigable
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
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
};

/**
 * Ícono temático según el tipo de acción
 */
const getIconoActividad = (tipo, descripcion = '') => {
  const txt = `${tipo || ''} ${descripcion || ''}`.toLowerCase();
  if (txt.includes('recarga') || txt.includes('saldo') || txt.includes('abono')) return '💳';
  if (txt.includes('reembolso') || txt.includes('devolucion') || txt.includes('cancel')) return '↩️';
  if (txt.includes('pedido') || txt.includes('compra') || txt.includes('orden') || txt.includes('cafe')) return '☕';
  if (txt.includes('qr') || txt.includes('retiro') || txt.includes('entrega')) return '📦';
  if (txt.includes('perfil') || txt.includes('usuario')) return '👤';
  return '📝';
};

const PerfilScreen = ({ session, isGuest, onLogout, onNavigateTab }) => {
  const user = session?.user;
  const authUserId = user?.id;

  // Estados de datos del usuario
  const [usuarioData, setUsuarioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [imgError, setImgError] = useState(false);

  // Estados de Wallet
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Estados de actividad reciente
  const [actividades, setActividades] = useState([]);
  const [actividadesLoading, setActividadesLoading] = useState(false);

  // Modal de edición de datos
  const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [apellidoEdit, setApellidoEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');
  const [erroresCampos, setErroresCampos] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
  });

  // Modales de Políticas y Ayuda
  const [modalPoliticaVisible, setModalPoliticaVisible] = useState(false);
  const [politicaActiva, setPoliticaActiva] = useState(null);

  const [modalAyudaVisible, setModalAyudaVisible] = useState(false);
  const [ayudaActiva, setAyudaActiva] = useState(null);

  // ─── Carga de datos de la Wallet ──────────────────────────────────
  const cargarWallet = useCallback(async (usuarioIdInterno) => {
    if (isGuest || (!usuarioIdInterno && !authUserId)) {
      setWallet(null);
      return;
    }

    setWalletLoading(true);
    try {
      let query = supabase.from('wallets').select('*');
      if (usuarioIdInterno) {
        query = query.eq('usuario_id', usuarioIdInterno);
      } else if (authUserId) {
        query = query.eq('usuario_id', authUserId);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        setWallet(data);
        return data;
      } else {
        setWallet({ saldo_actual: 0 });
        return { saldo_actual: 0 };
      }
    } catch (err) {
      console.warn('[PerfilScreen] Aviso al cargar wallet:', err?.message);
      setWallet({ saldo_actual: 0 });
      return null;
    } finally {
      setWalletLoading(false);
    }
  }, [authUserId, isGuest]);

  // ─── Carga de Actividad Reciente ──────────────────────────────────
  const cargarActividad = useCallback(async (usuarioIdInterno, walletId) => {
    if (isGuest) {
      setActividades([]);
      return;
    }

    setActividadesLoading(true);
    try {
      const items = [];

      // 1. Intentar cargar últimos movimientos de wallet
      if (walletId) {
        const { data: movsWallet } = await supabase
          .from('movimientos_wallet')
          .select('*')
          .eq('wallet_id', walletId)
          .order('creado_en', { ascending: false })
          .limit(4);

        if (movsWallet && movsWallet.length > 0) {
          movsWallet.forEach((m) => {
            items.push({
              id: `wallet-${m.id}`,
              tipo: m.tipo || 'movimiento',
              titulo: m.tipo === 'recarga' ? 'Recarga de Saldo' : m.tipo === 'reembolso' ? 'Reembolso a Wallet' : 'Pago de Pedido',
              descripcion: m.descripcion || (m.tipo === 'recarga' ? 'Abono en cuenta' : 'Consumo en cafetería'),
              monto: m.monto,
              esIngreso: m.tipo === 'recarga' || m.tipo === 'reembolso',
              fecha: m.creado_en,
              pedido_id: m.pedido_id || null,
            });
          });
        }
      }

      // 2. Si no hay suficientes movimientos, consultar últimos pedidos
      if (items.length < 4 && usuarioIdInterno) {
        const { data: ultimosPedidos } = await supabase
          .from('pedidos')
          .select('id, total, estado, creado_en, cafeterias(nombre)')
          .eq('usuario_id', usuarioIdInterno)
          .order('creado_en', { ascending: false })
          .limit(4);

        if (ultimosPedidos && ultimosPedidos.length > 0) {
          ultimosPedidos.forEach((p) => {
            // Evitar duplicar si ya vino de movimientos
            if (!items.some((i) => i.descripcion?.includes(`#${p.id}`))) {
              items.push({
                id: `pedido-${p.id}`,
                tipo: 'pedido',
                titulo: `Pedido en ${p.cafeterias?.nombre || 'Cafetería'}`,
                descripcion: `Estado: ${p.estado || 'Confirmado'} (#${p.id})`,
                monto: p.total,
                esIngreso: false,
                fecha: p.creado_en,
              });
            }
          });
        }
      }

      // 3. Fallback adicional a logs_auditoria si la lista sigue vacía
      if (items.length === 0) {
        try {
          let logQuery = supabase.from('logs_auditoria').select('*');
          if (usuarioIdInterno) {
            logQuery = logQuery.eq('usuario_id', usuarioIdInterno);
          } else if (authUserId) {
            logQuery = logQuery.eq('auth_user_id', authUserId);
          }
          const { data: logs } = await logQuery.order('creado_en', { ascending: false }).limit(3);
          if (logs && logs.length > 0) {
            logs.forEach((l) => {
              items.push({
                id: `log-${l.id}`,
                tipo: 'auditoria',
                titulo: l.tipo_evento?.replace(/_/g, ' ') || 'Actividad en cuenta',
                descripcion: l.metadata?.descripcion || 'Registro de sistema',
                monto: null,
                esIngreso: false,
                fecha: l.creado_en || l.created_at,
              });
            });
          }
        } catch {
          // No bloqueante
        }
      }

      // Ordenar por fecha descendente y limitar a 4
      items.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
      setActividades(items.slice(0, 4));
    } catch (err) {
      console.warn('[PerfilScreen] Aviso al cargar actividad reciente:', err?.message);
      setActividades([]);
    } finally {
      setActividadesLoading(false);
    }
  }, [authUserId, isGuest]);

  // ─── Carga Integral del Perfil ────────────────────────────────────
  const cargarPerfil = useCallback(async () => {
    if (isGuest || !authUserId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setErrorCarga(null);

    try {
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

      let usuarioFinal = null;
      if (data) {
        const rolExtraido = data.roles?.nombre || data.rol || user?.user_metadata?.rol || 'estudiante';
        usuarioFinal = {
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
      } else {
        const parts = (user?.user_metadata?.full_name || '').trim().split(' ');
        usuarioFinal = {
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
      }

      setUsuarioData(usuarioFinal);

      // Cargar en paralelo Wallet y Actividad
      const wData = await cargarWallet(usuarioFinal?.id);
      await cargarActividad(usuarioFinal?.id, wData?.id);
    } catch (err) {
      console.warn('Error al cargar datos del perfil:', err.message);
      setErrorCarga(err.message || 'No se pudo cargar la información de tu perfil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUserId, isGuest, user, cargarWallet, cargarActividad]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarPerfil();
  };

  // ─── Validaciones de Edición de Perfil (S2-T8) ────────────────────
  const validarNombre = (val) => {
    const limpio = (val || '').trim();
    if (!limpio) return 'El nombre es obligatorio.';
    if (limpio.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
    if (limpio.length > 50) return 'El nombre no puede superar los 50 caracteres.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(limpio)) {
      return 'El nombre solo debe contener letras.';
    }
    return '';
  };

  const validarApellido = (val) => {
    const limpio = (val || '').trim();
    if (!limpio) return 'El apellido es obligatorio.';
    if (limpio.length < 2) return 'El apellido debe tener al menos 2 caracteres.';
    if (limpio.length > 50) return 'El apellido no puede superar los 50 caracteres.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(limpio)) {
      return 'El apellido solo debe contener letras.';
    }
    return '';
  };

  const validarTelefono = (val) => {
    const limpio = (val || '').trim();
    if (!limpio) return ''; // Campo opcional
    if (limpio.length > 20) return 'El teléfono no puede superar los 20 caracteres.';
    const digitos = limpio.replace(/[\s\-\(\)\+]/g, '');
    if (!/^\+?[0-9\s\-()]{8,20}$/.test(limpio) || digitos.length < 8) {
      return 'Formato inválido. Ej: +56 9 1234 5678 o 912345678';
    }
    return '';
  };

  const validarCamposEdicion = () => {
    const errNombre = validarNombre(nombreEdit);
    const errApellido = validarApellido(apellidoEdit);
    const errTelefono = validarTelefono(telefonoEdit);

    const errs = {
      nombre: errNombre,
      apellido: errApellido,
      telefono: errTelefono,
    };

    setErroresCampos(errs);
    return !errNombre && !errApellido && !errTelefono;
  };

  const abrirModalEdicion = () => {
    setErrorEdit('');
    setErroresCampos({ nombre: '', apellido: '', telefono: '' });
    setNombreEdit(usuarioData?.nombre || '');
    setApellidoEdit(usuarioData?.apellido || '');
    setTelefonoEdit(usuarioData?.telefono || '');
    setModalEdicionVisible(true);
  };

  const guardarEdicion = async () => {
    setErrorEdit('');

    if (!validarCamposEdicion()) {
      return;
    }

    const nombreLimpio = nombreEdit.trim();
    const apellidoLimpio = apellidoEdit.trim();
    const telLimpio = telefonoEdit.trim();

    const actualNombre = (usuarioData?.nombre || '').trim();
    const actualApellido = (usuarioData?.apellido || '').trim();
    const actualTel = (usuarioData?.telefono || '').trim();

    // Si no hubo cambios en ninguno de los campos autorizados, avisar y no hacer peticiones innecesarias
    if (
      nombreLimpio === actualNombre &&
      apellidoLimpio === actualApellido &&
      telLimpio === actualTel
    ) {
      Alert.alert('Sin cambios', 'No se realizaron modificaciones en tus datos.');
      setModalEdicionVisible(false);
      return;
    }

    // Whitelist estricta de atributos autorizados para modificación (previene mass-assignment)
    const payloadAutorizado = {
      nombre: nombreLimpio,
      apellido: apellidoLimpio,
      telefono: telLimpio || null,
    };

    // Bloqueo explícito contra manipulación de datos de autenticación o roles (S2-T8)
    const camposSensibles = ['email', 'correo', 'rol', 'rol_id', 'password_hash', 'saldo', 'saldo_actual', 'activo'];
    for (const campo of camposSensibles) {
      if (campo in payloadAutorizado) {
        throw new Error(`Modificación rechazada: el dato "${campo}" está protegido por el sistema.`);
      }
    }

    setGuardando(true);

    try {
      let usuarioGuardadoId = usuarioData?.id;

      // 1. Persistir cambios en la tabla public.usuarios
      if (usuarioGuardadoId) {
        const payloadConAuth = {
          ...payloadAutorizado,
          ...(authUserId ? { auth_user_id: authUserId } : {}),
        };
        const { error: updateError } = await supabase
          .from('usuarios')
          .update(payloadConAuth)
          .eq('id', usuarioGuardadoId);

        if (updateError) throw updateError;
      } else if (authUserId) {
        let updateQ = supabase
          .from('usuarios')
          .update({
            ...payloadAutorizado,
            auth_user_id: authUserId,
          });

        if (user?.email) {
          updateQ = updateQ.or(`auth_user_id.eq.${authUserId},email.eq.${user.email}`);
        } else {
          updateQ = updateQ.eq('auth_user_id', authUserId);
        }

        const { data: updateData, error: updateError } = await updateQ.select('id');

        if (updateError) throw updateError;

        if (updateData && updateData.length > 0) {
          usuarioGuardadoId = updateData[0].id;
        } else {
          // Si no existía registro previo en public.usuarios, crearlo con datos autorizados
          const nuevoUsuario = {
            ...payloadAutorizado,
            auth_user_id: authUserId,
            email: user?.email || '',
            password_hash: 'supabase_auth_managed',
            rol_id: 1, // Rol 'estudiante' por defecto
            activo: true,
          };
          const { data: insertData, error: insertError } = await supabase
            .from('usuarios')
            .insert(nuevoUsuario)
            .select('id')
            .single();

          if (insertError) throw insertError;
          if (insertData) usuarioGuardadoId = insertData.id;
        }
      } else {
        throw new Error('No se identificó la sesión del usuario.');
      }

      // 2. Persistir sincronización en los metadatos de Supabase Auth
      try {
        await supabase.auth.updateUser({
          data: {
            first_name: nombreLimpio,
            last_name: apellidoLimpio,
            full_name: `${nombreLimpio} ${apellidoLimpio}`.trim(),
            telefono: telLimpio || null,
          },
        });
      } catch (authErr) {
        console.warn('[PerfilScreen] Aviso al sincronizar auth.users:', authErr?.message);
      }

      // 3. Actualizar estado local inmediatamente para reflejar cambios en la UI
      setUsuarioData((prev) => ({
        ...prev,
        id: usuarioGuardadoId || prev?.id,
        nombre: nombreLimpio,
        apellido: apellidoLimpio,
        telefono: telLimpio || '',
      }));

      setModalEdicionVisible(false);
      Alert.alert(
        '¡Perfil actualizado!',
        'Tus datos personales fueron modificados y persistidos correctamente.'
      );
    } catch (err) {
      console.error('Error al persistir cambios de perfil:', err);
      setErrorEdit(
        err.message?.includes('policy')
          ? 'Error de seguridad: la directiva del sistema no autorizó la operación.'
          : err.message || 'No fue posible guardar los cambios. Inténtalo nuevamente.'
      );
    } finally {
      setGuardando(false);
    }
  };

  // ─── Confirmación de Cierre de Sesión ─────────────────────────────
  const confirmarCierreSesion = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas salir de tu cuenta en CoffeeFast?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  // ─── Apertura de Políticas y Ayuda ────────────────────────────────
  const abrirPolitica = (tipo) => {
    setPoliticaActiva(tipo);
    setModalPoliticaVisible(true);
  };

  const abrirAyuda = (tipo) => {
    setAyudaActiva(tipo);
    setModalAyudaVisible(true);
  };

  // ─── Render: Caso Modo Invitado ───────────────────────────────────
  if (isGuest) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card variant="elevated" style={styles.guestHeroCard}>
            <View style={styles.guestAvatar}>
              <Text style={styles.guestAvatarText}>🎓</Text>
            </View>
            <Text style={styles.guestTitle}>Modo Invitado</Text>
            <Text style={styles.guestSubtitle}>Explorando CoffeeFast UCT</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Acceso Temporal</Text>
            </View>
          </Card>

          <Card variant="outlined" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Accede a todos los beneficios</Text>
            <Text style={styles.sectionText}>
              Inicia sesión con tu correo institucional (@alu.uct.cl) para activar tu Billetera Virtual, acumular saldo, consultar tu historial de pedidos y gestionar tu perfil de estudiante.
            </Text>
          </Card>

          {/* Políticas en modo invitado */}
          <Card variant="outlined" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Información y Políticas</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => abrirPolitica('terminos')}>
              <Text style={styles.menuRowIcon}>📋</Text>
              <Text style={styles.menuRowText}>Términos del Servicio</Text>
              <Text style={styles.menuRowChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.menuRow} onPress={() => abrirPolitica('privacidad')}>
              <Text style={styles.menuRowIcon}>🔒</Text>
              <Text style={styles.menuRowText}>Privacidad y Seguridad</Text>
              <Text style={styles.menuRowChevron}>›</Text>
            </TouchableOpacity>
          </Card>

          <Button
            title="Iniciar sesión / Registrarme"
            onPress={onLogout}
            variant="primary"
            style={styles.actionButton}
          />
        </ScrollView>

        {/* Modal de Políticas para Invitados */}
        {renderModalPolitica()}
      </View>
    );
  }

  // ─── Render: Caso Cargando ────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.cafeOscuro} />
          <Text style={styles.loadingText}>Cargando datos del estudiante...</Text>
        </View>
      </View>
    );
  }

  // ─── Render: Caso Error Crítico ───────────────────────────────────
  if (errorCarga && !usuarioData) {
    return (
      <View style={styles.container}>
        <Header title="Mi Perfil" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Error al cargar perfil</Text>
          <Text style={styles.errorDescription}>{errorCarga}</Text>
          <Button
            title="Reintentar carga"
            onPress={cargarPerfil}
            variant="primary"
            style={{ marginTop: spacing.md, minWidth: 160 }}
          />
        </View>
      </View>
    );
  }

  // ─── Datos formateados para la vista ──────────────────────────────
  const nombreCompleto = `${usuarioData?.nombre || ''} ${usuarioData?.apellido || ''}`.trim() || 'Estudiante UCT';
  const inicial = (
    usuarioData?.nombre?.[0]
      ? `${usuarioData.nombre[0]}${usuarioData?.apellido?.[0] || ''}`
      : usuarioData?.correo?.[0] || 'E'
  ).toUpperCase();

  const fechaMiembro = formatFecha(usuarioData?.creado_en);
  const rolLegible = formatearRol(usuarioData?.rol);
  const saldoActual = wallet?.saldo_actual ?? 0;

  // ─── Modal Content: Políticas ─────────────────────────────────────
  function renderModalPolitica() {
    let titulo = 'Información';
    let contenido = null;

    if (politicaActiva === 'terminos') {
      titulo = 'Términos del Servicio';
      contenido = (
        <ScrollView style={styles.modalScroll}>
          <Text style={styles.modalBodyTitle}>1. Servicio de Cafetería Digital</Text>
          <Text style={styles.modalBodyText}>
            CoffeeFast es una plataforma institucional diseñada para agilizar la compra y retiro anticipado de productos en las cafeterías universitarias de la Universidad Católica de Temuco.
          </Text>
          <Text style={styles.modalBodyTitle}>2. Selección de Cafetería y Pedidos</Text>
          <Text style={styles.modalBodyText}>
            Cada pedido se genera hacia una cafetería específica para asegurar la frescura de las preparaciones. El estudiante debe confirmar los productos seleccionados y pagarlos mediante su Billetera Virtual (Wallet).
          </Text>
          <Text style={styles.modalBodyTitle}>3. Códigos Únicos de Retiro</Text>
          <Text style={styles.modalBodyText}>
            Al confirmarse el pago, la aplicación emite un Código QR encriptado y un código de retiro alfanumérico que debe ser presentado personalmente en el mesón de entrega.
          </Text>
        </ScrollView>
      );
    } else if (politicaActiva === 'privacidad') {
      titulo = 'Privacidad y Seguridad de Datos';
      contenido = (
        <ScrollView style={styles.modalScroll}>
          <Text style={styles.modalBodyTitle}>1. Protección de Datos Estudiantiles</Text>
          <Text style={styles.modalBodyText}>
            Tu información personal (nombre, correo institucional @alu.uct.cl y teléfono de contacto) es utilizada exclusivamente para la validación de órdenes y seguridad en el campus.
          </Text>
          <Text style={styles.modalBodyTitle}>2. Seguridad RLS (Row Level Security)</Text>
          <Text style={styles.modalBodyText}>
            Toda modificación y consulta de tu perfil está protegida a nivel de base de datos por la directiva de seguridad usuarios_update_own en Supabase. Nadie puede alterar tus datos personales sin tus credenciales.
          </Text>
          <Text style={styles.modalBodyTitle}>3. Seguridad de Pagos</Text>
          <Text style={styles.modalBodyText}>
            CoffeeFast no almacena números de tarjetas de crédito o débito; todas las operaciones financieras se liquidan a través de la Wallet institucional.
          </Text>
        </ScrollView>
      );
    } else if (politicaActiva === 'retiro') {
      titulo = 'Políticas de Retiro y Franja Horaria';
      contenido = (
        <ScrollView style={styles.modalScroll}>
          <Text style={styles.modalBodyTitle}>1. Franjas Horarias de Entrega</Text>
          <Text style={styles.modalBodyText}>
            Al realizar un pedido, se te asignará una franja horaria estimada (15 a 20 minutos). Te recomendamos acudir puntualmente para recibir tu bebida o alimento a temperatura óptima.
          </Text>
          <Text style={styles.modalBodyTitle}>2. Validación por QR o Código</Text>
          <Text style={styles.modalBodyText}>
            Para retirar, muestra el código QR desde la pestaña Pedidos al personal de cafetería. El sistema marcará automáticamente la orden como entregada.
          </Text>
          <Text style={styles.modalBodyTitle}>3. Cancelación y Reembolso</Text>
          <Text style={styles.modalBodyText}>
            Si una orden es cancelada por falta de stock o por el usuario antes del inicio de su preparación, el monto total se reembolsa al instante a tu saldo de Wallet.
          </Text>
        </ScrollView>
      );
    }

    return (
      <Modal
        visible={modalPoliticaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalPoliticaVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{titulo}</Text>
              <TouchableOpacity
                onPress={() => setModalPoliticaVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {contenido}
            <Button
              title="Entendido"
              variant="primary"
              onPress={() => setModalPoliticaVisible(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    );
  }

  // ─── Modal Content: Ayuda ─────────────────────────────────────────
  function renderModalAyuda() {
    let titulo = 'Centro de Ayuda';
    let contenido = null;

    if (ayudaActiva === 'faq') {
      titulo = 'Preguntas Frecuentes (FAQ)';
      contenido = (
        <ScrollView style={styles.modalScroll}>
          <Text style={styles.modalBodyTitle}>¿Cómo recargo mi Billetera Virtual?</Text>
          <Text style={styles.modalBodyText}>
            Dirígete a la pestaña "Wallet" desde la barra inferior o desde el botón de acceso rápido en este perfil. Selecciona un monto predefinido ($2.000, $5.000, etc.) y confirma la recarga.
          </Text>
          <Text style={styles.modalBodyTitle}>¿Cómo retiro mi pedido en la cafetería?</Text>
          <Text style={styles.modalBodyText}>
            En la pestaña "Pedidos", presiona tu orden activa para desplegar el Código QR de retiro. Preséntalo en el mesón de entrega en el campus.
          </Text>
          <Text style={styles.modalBodyTitle}>¿Qué pasa si mi pedido fue cancelado?</Text>
          <Text style={styles.modalBodyText}>
            El valor del pedido se reintegra de forma automática a tu saldo de Wallet. Puedes verificar el abono en tu sección de Actividad Reciente.
          </Text>
        </ScrollView>
      );
    } else if (ayudaActiva === 'contacto') {
      titulo = 'Contacto y Soporte UCT';
      contenido = (
        <View style={styles.modalScroll}>
          <Text style={styles.modalBodyText}>
            ¿Tienes dudas con tu cuenta, problemas con un retiro o necesitas asistencia con tu saldo?
          </Text>
          <View style={styles.contactItemBox}>
            <Text style={styles.contactLabel}>📧 Correo de soporte:</Text>
            <Text style={styles.contactValue}>soporte.cafeteria@alu.uct.cl</Text>
          </View>
          <View style={styles.contactItemBox}>
            <Text style={styles.contactLabel}>⏰ Horario de atención:</Text>
            <Text style={styles.contactValue}>Lunes a Viernes: 08:30 - 18:30 hrs</Text>
          </View>
          <View style={styles.contactItemBox}>
            <Text style={styles.contactLabel}>📍 Ubicaciones:</Text>
            <Text style={styles.contactValue}>Campus San Juan Pablo II & Campus San Francisco</Text>
          </View>
        </View>
      );
    }

    return (
      <Modal
        visible={modalAyudaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAyudaVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{titulo}</Text>
              <TouchableOpacity
                onPress={() => setModalAyudaVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {contenido}
            <Button
              title="Cerrar"
              variant="primary"
              onPress={() => setModalAyudaVisible(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Mi Perfil" />

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
        {/* ─── 1. TARJETA HERO: DATOS DEL ESTUDIANTE ─────────────────── */}
        <Card variant="elevated" style={styles.studentHeroCard}>
          <View style={styles.avatarWrapper}>
            {usuarioData?.foto && !imgError ? (
              <Image
                source={{ uri: usuarioData.foto }}
                style={styles.avatarImage}
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitialText}>{inicial}</Text>
              </View>
            )}
            <View style={styles.onlineBadge} />
          </View>

          <Text style={styles.studentName}>{nombreCompleto}</Text>
          <Text style={styles.studentEmail}>{usuarioData?.correo || 'Sin correo asignado'}</Text>

          {/* Badges de Estado y Rol */}
          <View style={styles.badgesRow}>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipIcon}>🎓</Text>
              <Text style={styles.roleChipText}>{rolLegible}</Text>
            </View>
            {Boolean(usuarioData?.telefono) && (
              <View style={styles.phoneChip}>
                <Text style={styles.phoneChipIcon}>📞</Text>
                <Text style={styles.phoneChipText}>{usuarioData.telefono}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={abrirModalEdicion}
            activeOpacity={0.8}
          >
            <Text style={styles.editProfileBtnText}>✏️ Modificar datos personales</Text>
          </TouchableOpacity>
        </Card>

        {/* ─── 2. SECCIÓN WALLET: SALDO Y ACCESO RÁPIDO ─────────────── */}
        <Card variant="elevated" style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <View style={styles.walletLabelContainer}>
              <Text style={styles.walletHeaderIcon}>💳</Text>
              <Text style={styles.walletHeaderTitle}>Billetera CoffeeFast</Text>
            </View>
          </View>

          <Text style={styles.walletBalanceLabel}>Saldo disponible</Text>
          {walletLoading ? (
            <ActivityIndicator size="small" color={colors.blanco} style={{ marginVertical: 8, alignSelf: 'flex-start' }} />
          ) : (
            <Text style={styles.walletBalanceAmount}>{formatCLP(saldoActual)}</Text>
          )}

          <TouchableOpacity
            style={styles.walletActionBtn}
            activeOpacity={0.85}
            onPress={() => onNavigateTab ? onNavigateTab('wallet') : Alert.alert('Wallet', 'Navega a la pestaña Wallet en la barra inferior.')}
          >
            <Text style={styles.walletActionBtnText}>Gestionar Wallet y Recargar</Text>
            <Text style={styles.walletActionChevron}>→</Text>
          </TouchableOpacity>
        </Card>

        {/* ─── 3. SECCIÓN: ACTIVIDAD RECIENTE ───────────────────────── */}
        <Card variant="outlined" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionHeaderEmoji}>🕒</Text>
              <Text style={styles.sectionTitle}>Actividad Reciente</Text>
            </View>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={styles.refreshLink}>Actualizar</Text>
            </TouchableOpacity>
          </View>

          {actividadesLoading ? (
            <View style={styles.miniLoaderBox}>
              <ActivityIndicator size="small" color={colors.cafeOscuro} />
              <Text style={styles.miniLoaderText}>Cargando actividad...</Text>
            </View>
          ) : actividades.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateEmoji}>☕</Text>
              <Text style={styles.emptyStateTitle}>Sin actividad reciente</Text>
              <Text style={styles.emptyStateDescription}>
                Tus compras de café, colaciones y recargas de saldo se listarán automáticamente aquí.
              </Text>
            </View>
          ) : (
            actividades.map((item, index) => {
              const icono = getIconoActividad(item.tipo, item.titulo);
              return (
                <View key={item.id || index}>
                  <View style={styles.activityRow}>
                    <View style={styles.activityIconCircle}>
                      <Text style={styles.activityIconText}>{icono}</Text>
                    </View>
                    <View style={styles.activityMainInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{item.titulo}</Text>
                      <Text style={styles.activitySub} numberOfLines={1}>{item.descripcion}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.activityDate}>{formatFecha(item.fecha)}</Text>
                        {item.pedido_id && (
                          <View style={styles.activityPedidoBadge}>
                            <Text style={styles.activityPedidoText}>📦 #{item.pedido_id}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {item.monto !== null && item.monto !== undefined && (
                      <Text style={[styles.activityAmount, item.esIngreso ? styles.amountPositive : styles.amountNegative]}>
                        {item.esIngreso ? `+${formatCLP(item.monto)}` : `-${formatCLP(item.monto)}`}
                      </Text>
                    )}
                  </View>
                  {index < actividades.length - 1 && <View style={styles.separator} />}
                </View>
              );
            })
          )}
        </Card>

        {/* ─── 4. SECCIÓN: POLÍTICAS INSTITUCIONALES ─────────────────── */}
        <Card variant="outlined" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionHeaderEmoji}>📜</Text>
              <Text style={styles.sectionTitle}>Políticas y Condiciones</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.menuRow} onPress={() => abrirPolitica('terminos')} activeOpacity={0.7}>
            <View style={styles.menuRowLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuRowIcon}>📋</Text>
              </View>
              <View>
                <Text style={styles.menuRowText}>Términos del Servicio</Text>
                <Text style={styles.menuRowSub}>Condiciones de compra y retiro UCT</Text>
              </View>
            </View>
            <Text style={styles.menuRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.menuRow} onPress={() => abrirPolitica('privacidad')} activeOpacity={0.7}>
            <View style={styles.menuRowLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuRowIcon}>🔒</Text>
              </View>
              <View>
                <Text style={styles.menuRowText}>Privacidad y Seguridad</Text>
                <Text style={styles.menuRowSub}>Protección de datos y directiva RLS</Text>
              </View>
            </View>
            <Text style={styles.menuRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.menuRow} onPress={() => abrirPolitica('retiro')} activeOpacity={0.7}>
            <View style={styles.menuRowLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuRowIcon}>⏱️</Text>
              </View>
              <View>
                <Text style={styles.menuRowText}>Retiro y Cancelaciones</Text>
                <Text style={styles.menuRowSub}>Franjas horarias y reembolsos a Wallet</Text>
              </View>
            </View>
            <Text style={styles.menuRowChevron}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* ─── 5. SECCIÓN: AYUDA Y SOPORTE ──────────────────────────── */}
        <Card variant="outlined" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionHeaderEmoji}>💬</Text>
              <Text style={styles.sectionTitle}>Ayuda y Soporte</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.menuRow} onPress={() => abrirAyuda('faq')} activeOpacity={0.7}>
            <View style={styles.menuRowLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuRowIcon}>❓</Text>
              </View>
              <View>
                <Text style={styles.menuRowText}>Preguntas Frecuentes (FAQ)</Text>
                <Text style={styles.menuRowSub}>Uso de QR, recargas y pedidos</Text>
              </View>
            </View>
            <Text style={styles.menuRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.menuRow} onPress={() => abrirAyuda('contacto')} activeOpacity={0.7}>
            <View style={styles.menuRowLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuRowIcon}>✉️</Text>
              </View>
              <View>
                <Text style={styles.menuRowText}>Contacto con Soporte</Text>
                <Text style={styles.menuRowSub}>Canales de atención estudiantil UCT</Text>
              </View>
            </View>
            <Text style={styles.menuRowChevron}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* ─── 6. CIERRE DE SESIÓN ──────────────────────────────────── */}
        <Button
          title="Cerrar sesión"
          onPress={confirmarCierreSesion}
          variant="danger"
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* ─── MODAL DE EDICIÓN DE DATOS PERSONALES (S2-T7) ───────────── */}
      <Modal
        visible={modalEdicionVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalEdicionVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Datos Personales</Text>
              <TouchableOpacity
                onPress={() => setModalEdicionVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Modifica únicamente los datos autorizados. Los datos de cuenta institucional están protegidos.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalEditScroll}
              contentContainerStyle={styles.modalEditScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {Boolean(errorEdit) && (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>{errorEdit}</Text>
                </View>
              )}

              {/* Campos autorizados para edición */}
              <Input
                label="Nombre *"
                placeholder="Ej. Juan"
                value={nombreEdit}
                onChangeText={(val) => {
                  setNombreEdit(val);
                  if (erroresCampos.nombre) {
                    setErroresCampos((prev) => ({ ...prev, nombre: validarNombre(val) }));
                  }
                }}
                onBlur={() => {
                  setErroresCampos((prev) => ({ ...prev, nombre: validarNombre(nombreEdit) }));
                }}
                maxLength={50}
                autoCapitalize="words"
                error={erroresCampos.nombre}
              />

              <Input
                label="Apellido *"
                placeholder="Ej. Pérez"
                value={apellidoEdit}
                onChangeText={(val) => {
                  setApellidoEdit(val);
                  if (erroresCampos.apellido) {
                    setErroresCampos((prev) => ({ ...prev, apellido: validarApellido(val) }));
                  }
                }}
                onBlur={() => {
                  setErroresCampos((prev) => ({ ...prev, apellido: validarApellido(apellidoEdit) }));
                }}
                maxLength={50}
                autoCapitalize="words"
                error={erroresCampos.apellido}
              />

              <Input
                label="Teléfono de contacto (Opcional)"
                placeholder="+56 9 1234 5678"
                value={telefonoEdit}
                onChangeText={(val) => {
                  setTelefonoEdit(val);
                  if (erroresCampos.telefono) {
                    setErroresCampos((prev) => ({ ...prev, telefono: validarTelefono(val) }));
                  }
                }}
                onBlur={() => {
                  setErroresCampos((prev) => ({ ...prev, telefono: validarTelefono(telefonoEdit) }));
                }}
                maxLength={20}
                keyboardType="phone-pad"
                error={erroresCampos.telefono}
              />

              {/* Datos protegidos por el sistema (Solo lectura) */}
              <View style={styles.protectedSection}>
                <View style={styles.protectedHeaderRow}>
                  <Text style={styles.protectedHeaderIcon}>🔒</Text>
                  <Text style={styles.protectedHeaderText}>Datos protegidos por el sistema</Text>
                </View>

                <View style={styles.protectedItem}>
                  <Text style={styles.protectedItemLabel}>Correo institucional (Solo lectura):</Text>
                  <Text style={styles.protectedItemValue}>{usuarioData?.correo || 'Sin correo asignado'}</Text>
                  <Text style={styles.protectedItemHint}>
                    Tu cuenta @alu.uct.cl es tu identidad oficial y no puede modificarse.
                  </Text>
                </View>

                <View style={styles.protectedDivider} />

                <View style={styles.protectedItem}>
                  <Text style={styles.protectedItemLabel}>Rol asignado (Solo lectura):</Text>
                  <Text style={styles.protectedItemValue}>{rolLegible}</Text>
                  <Text style={styles.protectedItemHint}>
                    Los roles y permisos son gestionados centralmente por la institución.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Acciones fijas al fondo: siempre visibles y sin cortes */}
            <View style={styles.modalActionsRow}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setModalEdicionVisible(false)}
                disabled={guardando}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title={guardando ? 'Guardando...' : 'Guardar Cambios'}
                variant="primary"
                onPress={guardarEdicion}
                disabled={guardando}
                loading={guardando}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modales de Políticas y Ayuda */}
      {renderModalPolitica()}
      {renderModalAyuda()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fondo,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
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

  // ─── 1. Tarjeta Hero Estudiante ──────────────────────────────────
  studentHeroCard: {
    backgroundColor: colors.blanco,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  avatarPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dorado,
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: colors.dorado,
    backgroundColor: colors.crema,
  },
  avatarInitialText: {
    fontSize: typography.tituloGrande,
    fontWeight: typography.pesoExtraBold,
    color: colors.cafeOscuro,
    fontFamily: typography.familia,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.verde,
    borderWidth: 2,
    borderColor: colors.blanco,
  },
  studentName: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  studentEmail: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    marginTop: 2,
    textAlign: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.doradoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.dorado,
  },
  roleChipIcon: {
    fontSize: 12,
  },
  roleChipText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.fondo,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  phoneChipIcon: {
    fontSize: 12,
  },
  phoneChipText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoMedio,
    color: colors.textoSecundario,
  },
  editProfileBtn: {
    marginTop: spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.crema,
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  editProfileBtnText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },

  // ─── 2. Tarjeta Wallet ───────────────────────────────────────────
  walletCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.cafeOscuro,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: colors.cafeOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  walletLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletHeaderIcon: {
    fontSize: 18,
  },
  walletHeaderTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
    color: colors.blanco,
    letterSpacing: 0.3,
  },
  walletBalanceLabel: {
    fontSize: typography.cuerpoPequeno,
    color: colors.bordeOscuro,
    marginTop: 2,
  },
  walletBalanceAmount: {
    fontSize: 28,
    fontWeight: typography.pesoExtraBold,
    color: colors.blanco,
    marginTop: 4,
    marginBottom: spacing.md,
    fontFamily: typography.familia,
  },
  walletActionBtn: {
    backgroundColor: colors.dorado,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  walletActionBtnText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  walletActionChevron: {
    fontSize: 14,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },

  // ─── Secciones Modulares ─────────────────────────────────────────
  sectionCard: {
    marginTop: spacing.lg,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionHeaderEmoji: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: typography.subtitulo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  sectionText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  refreshLink: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeMedio,
  },

  // ─── Filas de Actividad Reciente ─────────────────────────────────
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  activityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityIconText: {
    fontSize: 17,
  },
  activityMainInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoPrimario,
  },
  activitySub: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: 1,
  },
  activityDate: {
    fontSize: 10,
    color: colors.textoDeshabilitado,
  },
  activityPedidoBadge: {
    backgroundColor: colors.crema,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.bordeOscuro,
  },
  activityPedidoText: {
    fontSize: 9,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  activityAmount: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    marginLeft: spacing.sm,
  },
  amountPositive: {
    color: colors.verde,
  },
  amountNegative: {
    color: colors.cafeOscuro,
  },
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyStateEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyStateTitle: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginBottom: 4,
  },
  emptyStateDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    textAlign: 'center',
  },
  miniLoaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  miniLoaderText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
  },

  // ─── Filas de Menú (Políticas / Ayuda) ───────────────────────────
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.fondo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowIcon: {
    fontSize: 16,
  },
  menuRowText: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoMedio,
    color: colors.textoPrimario,
  },
  menuRowSub: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: 1,
  },
  menuRowChevron: {
    fontSize: 20,
    color: colors.cafeClaro,
    fontWeight: typography.pesoBold,
    paddingLeft: spacing.sm,
  },

  // ─── Separador ───────────────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: spacing.xs,
  },

  // ─── Footer y Logout ─────────────────────────────────────────────
  logoutBtn: {
    marginTop: spacing.xl,
    borderRadius: 14,
    height: 48,
  },

  // ─── Estilos Modo Invitado ───────────────────────────────────────
  guestHeroCard: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
  },
  guestAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.crema,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  guestAvatarText: {
    fontSize: 34,
  },
  guestTitle: {
    fontSize: typography.titulo,
    fontWeight: typography.pesoBold,
    color: colors.blanco,
  },
  guestSubtitle: {
    fontSize: typography.cuerpoPequeno,
    color: colors.bordeOscuro,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: colors.blanco,
    fontSize: 11,
    fontWeight: typography.pesoBold,
  },
  actionButton: {
    marginTop: spacing.xl,
    borderRadius: 14,
    height: 48,
  },

  // ─── Modales ─────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 88 : 80,
    marginBottom: -64,
    maxHeight: '92%',
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
    marginBottom: spacing.md,
  },
  modalEditScroll: {
    flexShrink: 1,
  },
  modalEditScrollContent: {
    paddingBottom: spacing.sm,
  },
  modalScroll: {
    marginVertical: spacing.sm,
    maxHeight: 320,
  },
  modalBodyTitle: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  modalBodyText: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
    lineHeight: 19,
    marginBottom: spacing.sm,
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
  modalActionsRow: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
    marginTop: spacing.xs,
  },
  protectedSection: {
    backgroundColor: colors.fondo,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borde,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  protectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  protectedHeaderIcon: {
    fontSize: 14,
  },
  protectedHeaderText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
  protectedItem: {
    paddingVertical: 2,
  },
  protectedItemLabel: {
    fontSize: 11,
    fontWeight: typography.pesoBold,
    color: colors.textoSecundario,
  },
  protectedItemValue: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoMedio,
    color: colors.cafeOscuro,
    marginTop: 1,
  },
  protectedItemHint: {
    fontSize: 10,
    color: colors.textoDeshabilitado,
    marginTop: 2,
    lineHeight: 14,
  },
  protectedDivider: {
    height: 1,
    backgroundColor: colors.borde,
    marginVertical: spacing.sm,
  },
  contactItemBox: {
    backgroundColor: colors.fondo,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contactLabel: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.cafeOscuro,
  },
});

export default PerfilScreen;
