import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Linking,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { vincularRenovacion } from './src/lib/sesion';
import { LoginScreen } from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { CafeteriaListScreen } from './src/screens/CafeteriaListScreen';
import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';
import PedidosScreen from './src/screens/PedidosScreen';
import WalletScreen from './src/screens/WalletScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import { Cafeteria } from './src/types/cafeteria';
import { CartProvider, useCart } from './src/context/CartContext';
import { useCartTotals } from './src/hooks/useCartTotals';
import { ApiError } from './src/services/backendClient';
import { crearPedidoDesdeCarrito, RetiroCheckout } from './src/services/crearPedidoDesdeCarrito';
import { consultarIntentoPendiente, leerCompraCotizadaPendiente } from './src/services/intentoCompra';
import { recuperarCompraCotizada } from './src/services/recuperarCompraCotizada';
import { avisarErrorIntentoCompra, ofrecerResolverIntento } from './src/services/avisarErrorIntentoCompra';
import { useCicloIntentoCompra } from './src/hooks/useCicloIntentoCompra';
import { verificarDisponibilidadCheckout } from './src/services/verificarDisponibilidadCheckout';
import {
  clasificarResultadoPago,
  clasificarPagoCotizado,
  type PagoCotizado,
  type PagoResult,
} from './src/utils/resultadoPago';
import AppIcon from './src/components/AppIcon';
import type { AppIconName } from './src/components/AppIcon';
import { colors } from './src/theme/colors';

const logo = require('./assets/icon.png');

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  iconName: AppIconName;
  available: boolean;
};

type CartItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  iconName: AppIconName;
  quantity: number;
  /**
   * De qué cafetería es el ítem. El pedido se hace contra UNA cafetería, así
   * que esto es lo que impide mezclar productos de dos menus distintos.
   */
  cafeteriaId: number;
  cafeteriaNombre: string;
};

type AppTab = 'cafeterias' | 'pedidos' | 'carrito' | 'wallet' | 'perfil';

const TAB_ICONS: Record<AppTab, AppIconName> = {
  cafeterias: 'store',
  pedidos: 'receipt',
  carrito: 'cart',
  wallet: 'card',
  perfil: 'user',
};

/**
 * Respuesta de la RPC `procesar_pago` (ver database/fixes/crear_rpc_pagos.sql).
 * Modela los dos caminos: aprobado y rechazado, con los campos que la app
 * necesita mostrarle al usuario. El tipo y la clasificación viven en
 * `src/utils/resultadoPago`.
 */

/**
 * Cuerpo de `POST /api/pedidos` (ver
 * `Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js`).
 *
 * El servicio responde 201 con `{ ok: true, pedido }`, donde `pedido` es el
 * retorno crudo de la RPC `procesar_pago`: el mismo objeto que antes la app
 * recibía como `data`. Notar que `ok` del envoltorio siempre es `true` en un
 * 201; el resultado real del pago está en `pedido.ok`.
 */
type RespuestaCrearPedido = PagoCotizado & {
  ok: boolean;
  pedido?: PagoResult | null;
};

type PedidoConfirmado = {
  descuento?: number;
  usuarioId: string;
  pedido_id: number;
  total: number;
  saldo_restante?: number;
  franja_retiro?: string;
  estado?: string;
  pago_estado?: string;
  qr_token?: string;
  codigo_retiro?: string;
};

const TABS: { key: AppTab; label: string }[] = [
  { key: 'cafeterias', label: 'Cafeterías' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'carrito', label: 'Carrito' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'perfil', label: 'Perfil' },
];

/**
 * S2-T15: límite de espera del `POST /api/pedidos`.
 *
 * Pasado este tiempo la app no puede saber si el pedido alcanzó a crearse y
 * cobrarse; por eso el timeout se informa como "resultado desconocido" y no
 * como pago rechazado. El carrito se conserva y no se reintenta solo.
 */
const TIMEOUT_CREAR_PEDIDO_MS = 15000;

function AppContent() {
  useEffect(() => vincularRenovacion(supabase.auth, AppState), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // FR-04: 'forgot' pide el código de recuperación,
  // 'reset' define la contraseña nueva una vez validado el código
  const [authScreen, setAuthScreen] = useState<
    'login' | 'register' | 'forgot' | 'reset'
  >('login');
  const [isGuest, setIsGuest] = useState(false);

  const [selectedCafeteria, setSelectedCafeteria] = useState<Cafeteria | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('cafeterias');
  const { cart, setCart, clearCart: vaciarCarrito, hydrated, codigo, setCodigo, idCarrito, requiereCotizacion, revision, requiereRecotizar, setRequiereRecotizar } = useCart() as {
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    clearCart: () => void;
    hydrated: boolean;
    codigo: string;
    setCodigo: (codigo: string) => void;
    idCarrito: number;
    requiereCotizacion: boolean;
    revision: number;
    requiereRecotizar: boolean;
    setRequiereRecotizar: (valor: boolean) => Promise<void>;
  };
  const [paying, setPaying] = useState(false);
  const usuarioActual = useRef(session?.user.id);
  usuarioActual.current = session?.user.id;
  const revisionActual = useRef(revision);
  revisionActual.current = revision;
  const recotizar = () => setCart(actual => [...actual]);
  const solicitarNuevoTotal = async () => {
    await setRequiereRecotizar(true);
    await reiniciar();
    Alert.alert('Cambió el total', 'No se realizó el cobro. Revisa la nueva cotización antes de confirmar.');
  };
  const checkoutEnCurso = useRef(false);
  const finalizarPago = () => { checkoutEnCurso.current = false; setPaying(false); };
  const { reiniciar, esperarReinicio } = useCicloIntentoCompra(
    session?.user.id, hydrated, cart.length === 0,
    error => avisarErrorIntentoCompra(error, reiniciar, () => handleTabPress('pedidos')),
  );
  const clearCart = async (conservarPendiente = true) => {
    try {
      await reiniciar(conservarPendiente);
      vaciarCarrito();
      return true;
    } catch (error) {
      avisarErrorIntentoCompra(error, reiniciar, () => handleTabPress('pedidos'));
      return false;
    }
  };
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // FR-04: Supabase emite PASSWORD_RECOVERY cuando el código del correo
      // es canjeado. Ese momento es el único en que hay una sesión temporal
      // válida para guardar la contraseña nueva. La pantalla de código
      // también avisa por prop, así que esto es el respaldo por si el evento
      // no llega.
      if (event === 'PASSWORD_RECOVERY') {
        setAuthScreen('reset');
      }

      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // S2-T2: Manejo robusto de Deep Linking para confirmación de correo (coffeefast://auth/callback)
  // Soporta tanto flujo implícito (access_token en hash) como flujo PKCE (code en query),
  // y notifica errores claros si el enlace expiró o fue reutilizado.
  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;
      try {
        // Extraer tanto query string como hash fragment
        const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
        const hashPart = url.includes('#') ? url.split('#')[1] : '';
        const combined = [queryPart, hashPart].filter(Boolean).join('&');
        if (!combined) return;

        const params = new URLSearchParams(combined);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        const type = params.get('type');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        if (error || errorDescription) {
          const mensajeError = decodeURIComponent(
            (errorDescription || error || 'El enlace de confirmación no es válido o ha expirado.').replace(/\+/g, ' ')
          );
          Alert.alert('Error de confirmación', mensajeError);
          return;
        }

        // Caso 1: Flujo PKCE (código de autorización)
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data?.session) {
            setSession(data.session);
            Alert.alert(
              '¡Cuenta confirmada!',
              'Tu correo institucional ha sido verificado exitosamente. Ya puedes utilizar CoffeeFast.'
            );
            return;
          } else if (exchangeError) {
            console.warn('[DeepLink] Error en exchangeCodeForSession:', exchangeError.message);
          }
        }

        // Caso 2: Flujo implícito (tokens directos)
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionError && data?.session) {
            setSession(data.session);
            Alert.alert(
              '¡Cuenta confirmada!',
              'Tu correo institucional ha sido verificado exitosamente. Ya puedes utilizar CoffeeFast.'
            );
          } else if (sessionError) {
            console.warn('[DeepLink] Error en setSession:', sessionError.message);
          }
        }
      } catch (err) {
        console.warn('[DeepLink] Error procesando enlace de autenticación:', err);
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkingSub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));

    return () => {
      linkingSub.remove();
    };
  }, []);

  /**
   * Botón físico / gesto de atrás de Android.
   *
   * La navegación es manual con useState, así que sin esto el gesto cerraba la
   * app desde cualquier nivel. Ahora se desciende un nivel por pulsación, en
   * orden inverso al de entrada:
   *
   *   Login/Registro/Recuperación  →  Login
   *   Menú de una cafetería         →  Listado de cafeterías
   *   Pestaña secundaria            →  Cafeterías
   *
   * Los handlers de los hijos (por ejemplo el detalle de producto, que es un
   * overlay dentro del menú) se registran después, y React Native invoca
   * primero el último registrado, así que el nivel más profundo gana.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // 1. Desde una pantalla de autenticación, volver al login.
      if (authScreen !== 'login') {
        setAuthScreen('login');
        return true;
      }

      // 2. Dentro del menú de una cafetería, volver al listado.
      //    Ojo: solo si estamos en la pestaña de cafeterías. Si el usuario
      //    está en carrito con una cafetería seleccionada, la conserva.
      if (activeTab === 'cafeterias' && selectedCafeteria) {
        setSelectedCafeteria(null);
        return true;
      }

      // 3. Desde cualquier otra pestaña, volver a cafeterías.
      if (activeTab !== 'cafeterias') {
        setActiveTab('cafeterias');
        return true;
      }

      // 4. Ya estamos en la raíz: dejamos que Android cierre la app.
      return false;
    });

    return () => subscription.remove();
  }, [authScreen, activeTab, selectedCafeteria]);

  const handleLogout = () => {
    Alert.alert(
      isGuest ? 'Salir de Invitado' : 'Cerrar Sesión',
      '¿Deseas salir a la pantalla de inicio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            if (checkoutEnCurso.current) return;
            setSelectedCafeteria(null);
            if (!await clearCart()) return;
            setActiveTab('cafeterias');
            if (isGuest) {
              setIsGuest(false);
            } else {
              await supabase.auth.signOut();
            }
          },
        },
      ]
    );
  };

  const handleSelectCafeteria = (cafeteria: Cafeteria) => {
    setSelectedCafeteria(cafeteria);
    setActiveTab('cafeterias');
  };

  const [navigating, setNavigating] = useState(false);

  const handleTabPress = (tab: AppTab) => {
    // Tocar la pestaña que ya está activa no debe hacer nada. Antes, tocar
    // "Cafeterías" estando dentro del menú de una cafetería ejecutaba el
    // setSelectedCafeteria(null) y te expulsaba al listado sin avisar.
    if (tab === activeTab || navigating) {
      return;
    }

    // Cambiar de pestaña NO borra la cafetería seleccionada: si el usuario
    // estaba leyendo el menú de una cafetería, vuelve exactamente donde
    // estaba. Para salir del menú está el botón "‹" y el gesto de atrás.
    setNavigating(true);
    setActiveTab(tab);
    setTimeout(() => setNavigating(false), 150);
  };

  /**
   * El carrito pertenece a UNA sola cafetería.
   *
   * La RPC `procesar_pago` recibe un único `p_cafeteria_id`, así que mezclar
   * productos de dos cafeterías en el mismo pedido guardaba los precios bien
   * pero mandaba los productos de A con el id de B. Antes esto pasaba en
   * silencio: el usuario podía recorrer A, agregar, volver al listado, entrar
   * a B y agregar, y el carrito aceptaba todo junto.
   *
   * Cada ítem guarda de qué cafetería es, y `cartCafeteria` define a cuál
   * pertenece el pedido.
   */
  const cartCafeteria: { id: number; nombre: string } | null =
    cart.length > 0 ? { id: cart[0].cafeteriaId, nombre: cart[0].cafeteriaNombre } : null;

  /** Agrega un producto al carrito. Sin preguntas: la cafetería ya coincide. */
  const agregarProducto = (product: Product, cafeteria: Cafeteria) => {
    const cafeteriaId = Number(cafeteria.id);

    setCart((currentCart: CartItem[]) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          iconName: product.iconName,
          quantity: 1,
          cafeteriaId,
          cafeteriaNombre: cafeteria.nombre,
        },
      ];
    });
  };

  const addToCart = (product: Product, cafeteria: Cafeteria) => {
    if (checkoutEnCurso.current || !product.available) {
      return;
    }

    const cafeteriaId = Number(cafeteria.id);

    // El carrito ya tiene productos de otra cafetería: no se mezclan.
    // La RPC recibe un único `p_cafeteria_id`, así que mezclar guardaba los
    // precios bien pero mandaba los productos de A con el id de B. Antes pasaba
    // en silencio. Ahora se le explica al usuario y se le da la opción de
    // cambiar de cafetería.
    if (cartCafeteria && cartCafeteria.id !== cafeteriaId) {
      Alert.alert(
        'Tu carrito es de otra cafetería',
        `Ya tenés productos de ${cartCafeteria.nombre}. Un pedido es de una sola cafetería. Si querés pedir en ${cafeteria.nombre}, vaciá el carrito.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            style: 'destructive',
            // Se vacía y se agrega en el mismo toque: si solo se vaciaba, el
            // botón prometía algo que no pasaba.
            onPress: async () => {
              if (!checkoutEnCurso.current && await clearCart()) agregarProducto(product, cafeteria);
            },
          },
        ]
      );
      return;
    }

    agregarProducto(product, cafeteria);
  };

  const increaseQuantity = (id: number) => {
    if (checkoutEnCurso.current) return;
    setCart((currentCart: CartItem[]) =>
      currentCart.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (id: number) => {
    if (checkoutEnCurso.current) return;
    setCart((currentCart: CartItem[]) =>
      currentCart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    if (checkoutEnCurso.current) return;
    setCart((currentCart: CartItem[]) =>
      currentCart.filter((item) => item.id !== id)
    );
  };

  /**
   * S2-T15: alerta única para resultado desconocido del pago.
   *
   * Se usa cuando la solicitud pudo haberse procesado pero no hay respuesta
   * (timeout o pérdida de conexión). No es un rechazo: el carrito se conserva
   * y NO se reintenta la compra automáticamente; se invita a revisar "Pedidos"
   * antes de volver a pagar para evitar un cobro duplicado.
   */
  const alertarResultadoIncierto = async () => {
    const usuarioId = session?.user.id;
    let recuperable = false;
    try {
      recuperable = Boolean(usuarioId && await leerCompraCotizadaPendiente(usuarioId));
    } catch (error) {
      if (avisarErrorIntentoCompra(error, reiniciar, () => handleTabPress('pedidos'))) return;
      Alert.alert('No pudimos confirmar tu pago',
        'No se pudo consultar el intento guardado. Revisa Pedidos antes de volver a pagar.', [
          { text: 'Cerrar', style: 'cancel' },
          { text: 'Revisar pedidos', onPress: () => handleTabPress('pedidos') },
        ]);
      return;
    }
    if (usuarioId && recuperable) {
      Alert.alert('No pudimos confirmar tu pago',
        'Si el pedido ya existe, se mostrará el mismo pedido. Si todavía no se procesó, se intentará confirmar con el importe original.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Revisar pedidos', onPress: () => handleTabPress('pedidos') },
          { text: 'Recuperar compra', onPress: () => recuperarCompra(usuarioId) },
        ]);
      return;
    }
    ofrecerResolverIntento(
      'No pudimos confirmar tu pago',
      'El pedido pudo registrarse. Revisa Pedidos antes de iniciar otra compra.',
      reiniciar,
      () => handleTabPress('pedidos'),
    );
  };

  const recuperarCompra = async (usuarioId: string) => {
    if (checkoutEnCurso.current || usuarioActual.current !== usuarioId) return;
    checkoutEnCurso.current = true;
    setPaying(true);
    try {
      const pago = await recuperarCompraCotizada(usuarioId, TIMEOUT_CREAR_PEDIDO_MS);
      if (usuarioActual.current !== usuarioId) return;
      if (!pago) {
        await alertarResultadoIncierto();
        return;
      }
      if (pago.tipo === 'recotizar' || pago.tipo === 'saldo_insuficiente') {
        if (usuarioActual.current === usuarioId) {
          if (pago.tipo === 'recotizar') await solicitarNuevoTotal();
          else {
            await reiniciar();
            Alert.alert('Saldo insuficiente en la Wallet',
            'No se realizó el cobro. Recarga tu Wallet y confirma el pedido de nuevo.');
          }
        }
        return;
      }
      setPedidoConfirmado({ ...pago.resultado, usuarioId });
      setActiveTab('pedidos');
      try {
        await reiniciar();
      } catch {
        if (usuarioActual.current === usuarioId) {
          Alert.alert('Pago confirmado', 'El comprobante está en Pedidos. No se pudo limpiar el intento guardado.');
        }
        return;
      }
      if (usuarioActual.current !== usuarioId) return;
      if ((pago.cuerpo.codigo ?? '') === codigo) {
        setCart(actual => {
          const items = actual.map(({ id, quantity }) => ({ producto_id: id, cantidad: quantity }));
          return actual[0]?.cafeteriaId === pago.cuerpo.cafeteria_id &&
            JSON.stringify(items) === JSON.stringify(pago.cuerpo.items) ? [] : actual;
        });
      }
      setRequiereRecotizar(false);
    } catch (error) {
      if (!avisarErrorIntentoCompra(error, reiniciar, () => handleTabPress('pedidos'))) {
        Alert.alert('No se pudo recuperar la compra', 'El intento sigue guardado. Revisa Pedidos o intenta recuperarlo más tarde.');
      }
    } finally {
      finalizarPago();
    }
  };

  const handleCheckout = async (franjaRetiro?: RetiroCheckout) => {
    // La cafetería del pedido sale de los propios ítems del carrito, no de
    // `selectedCafeteria`. Antes se leía de ahí, y como perder la cafetería
    // seleccionada era fácil (basta con cambiar de pestaña), el pago se
    // bloqueaba con un "Carrito vacío" que mentía: el carrito tenía productos.
    const cafeteriaId = cartCafeteria?.id;

    if (!session?.user) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para confirmar tu pedido.');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos desde el menú de una cafetería.');
      return;
    }

    if (!cafeteriaId) {
      Alert.alert(
        'No pudimos identificar la cafetería',
        'Vuelve al menú y agrega los productos otra vez.'
      );
      return;
    }

    if (!franjaRetiro?.franja) {
      Alert.alert('Selecciona una franja', 'Debes seleccionar un horario de retiro.');
      return;
    }

    if ((requiereRecotizar || requiereCotizacion) && franjaRetiro.totalAceptado === undefined) return;

    // La referencia bloquea otro toque incluso antes del siguiente render.
    if (checkoutEnCurso.current) return;
    checkoutEnCurso.current = true;
    setPaying(true);

    try {
      await esperarReinicio();
      // Recuperar un pago incierto no es una compra nueva ni depende del stock actual.
      // El backend aún no deduplica: no se reenvía el POST hasta poder resolverlo.
      if (await consultarIntentoPendiente(session.user.id)) {
        await alertarResultadoIncierto();
        return;
      }

      if (requiereRecotizar) {
        const importe = franjaRetiro.totalAceptado!.toLocaleString('es-CL');
        const aceptado = await new Promise<boolean>(resolver => {
          Alert.alert('Confirma el nuevo total', `El total actualizado es de $${importe}. ¿Quieres pagar ese importe?`, [
            { text: 'Rechazar', style: 'cancel', onPress: () => resolver(false) },
            { text: 'Aceptar y pagar', onPress: () => resolver(true) },
          ], { cancelable: true, onDismiss: () => resolver(false) });
        });
        if (!aceptado || revisionActual.current !== revision || usuarioActual.current !== session.user.id) return;
      }

      const problema = await verificarDisponibilidadCheckout(cart, cafeteriaId);
      if (problema) {
        Alert.alert(problema.titulo, problema.mensaje);
        return;
      }

      const formatCLP = (valor: number) => `$${Number(valor).toLocaleString('es-CL')}`;
      if (revisionActual.current !== revision || usuarioActual.current !== session.user.id) return;

      // C07 revalida el total aceptado antes de cobrar. Sin cotización se usa la RPC anterior.
      const respuesta = await crearPedidoDesdeCarrito<RespuestaCrearPedido | null>(
        cafeteriaId, cart, franjaRetiro, TIMEOUT_CREAR_PEDIDO_MS, session.user.id
      );

      // El backend responde HTTP 201 con `{ ok: true, pedido: <retorno de
      // procesar_pago> }`. Ojo: dentro de ese 201, `pedido` puede traer
      // `ok: false` (p. ej. saldo insuficiente), así que el chequeo real es
      // `pedido.ok` y no el código HTTP. La clasificación vive en
      // `utils/resultadoPago` para poder probarla sin montar la app entera.
      const clasificacion = franjaRetiro.totalAceptado === undefined
        ? clasificarResultadoPago(respuesta?.pedido ?? null)
        : clasificarPagoCotizado(respuesta, franjaRetiro.totalAceptado);

      // S2-T15: un 2xx sin `pedido` no confirma ni rechaza el pago; se trata
      // como resultado desconocido (carrito intacto, sin reintento automático).
      if (clasificacion.tipo === 'incierto') {
        await alertarResultadoIncierto();
        return;
      }

      if (clasificacion.tipo === 'saldo_insuficiente') {
        // Carrito intacto a proposito: el usuario recarga y reintenta.
        const rechazo = clasificacion.resultado;
        Alert.alert(
          'Saldo insuficiente en la Wallet',
          `Tu pedido cuesta ${formatCLP(rechazo.total ?? 0)} y te ` +
            `faltan ${formatCLP(rechazo.faltante ?? 0)}.\n` +
            `Saldo actual: ${formatCLP(rechazo.saldo_disponible ?? 0)}.`
        );
        return;
      }

      if (clasificacion.tipo === 'rechazado') {
        Alert.alert(
          'Pago rechazado',
          clasificacion.resultado.mensaje || 'No fue posible procesar el pago.'
        );
        return;
      }

      // S2-T14: validar que la respuesta del pago identifique el pedido y
      // traiga los montos completos ANTES de vaciar el carrito. Una respuesta
      // incompleta no debe confirmar el pago ni borrar el carrito.
      if (clasificacion.tipo === 'pedido_id_invalido') {
        Alert.alert(
          'Error inesperado',
          'La respuesta del servidor no incluye un identificador de pedido válido.'
        );
        return;
      }

      if (clasificacion.tipo === 'datos_incompletos') {
        Alert.alert(
          'Error inesperado',
          'La respuesta del servidor está incompleta.'
        );
        return;
      }

      const resultado = clasificacion.resultado;

      // Solo un resultado confirmado y completo limpia el carrito:
      if (!await clearCart(false)) return;
      setRequiereRecotizar(false);
      setPedidoConfirmado({
        usuarioId: session.user.id,
        pedido_id: resultado.pedido_id,
        total: resultado.total,
        descuento: resultado.descuento,
        saldo_restante: resultado.saldo_restante,
        franja_retiro: resultado.franja_retiro,
        estado: resultado.estado,
        pago_estado: resultado.pago_estado,
        qr_token: resultado.qr_token,
        codigo_retiro: resultado.codigo_retiro,
      });
      Alert.alert(
        'Pago aprobado',
        resultado.saldo_restante === undefined
          ? `Total pagado: ${formatCLP(resultado.total)}.`
          : `Tu pedido fue pagado con Wallet.\nSaldo restante: ${formatCLP(resultado.saldo_restante)}.`
      );
    } catch (e) {
      if (avisarErrorIntentoCompra(e, reiniciar, () => handleTabPress('pedidos'))) return;
      if (e instanceof ApiError && e.status === 409 && e.message === 'precio_actualizado') {
        try {
          await solicitarNuevoTotal();
        } catch (error) {
          if (!avisarErrorIntentoCompra(error, reiniciar, () => handleTabPress('pedidos'))) {
            Alert.alert('No se pudo guardar el nuevo total', 'El intento sigue guardado. Vuelve a consultar tu compra.');
          }
        }
        return;
      }
      if (e instanceof ApiError && e.status === 422 && e.message === 'saldo_insuficiente') {
        Alert.alert('Saldo insuficiente en la Wallet', 'Recarga tu Wallet para confirmar el pedido.');
        return;
      }
      if (e instanceof ApiError && e.status === 503 && e.message === 'confirmacion_afiliada_no_disponible') {
        Alert.alert('Confirmación no disponible', 'No se realizó el cobro. Intenta más tarde.');
        return;
      }
      // S2-T15: timeout o pérdida de conexión DESPUÉS de enviar la solicitud.
      // El pago pudo procesarse, así que no se presenta como rechazo, no se
      // vacía el carrito y no se reintenta automáticamente.
      if (e instanceof ApiError && e.resultadoIncierto) {
        await alertarResultadoIncierto();
        return;
      }

      // `ApiError` con respuesta HTTP cubre las fallas definitivas (sesión
      // vencida, backend caído con respuesta); el resto es inesperado.
      Alert.alert(
        'No se pudo procesar el pago',
        e instanceof ApiError
          ? 'Revisa tu conexión e inténtalo nuevamente.'
          : 'Ocurrio un error inesperado. Intentalo nuevamente.'
      );
    } finally {
      finalizarPago();
    }
  };

  const { totalProducts } = useCartTotals(cart);

  if (loading || !hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A3728" />
      </View>
    );
  }

  const isUserAllowed = Boolean((session && session.user) || isGuest);

  // FR-04: la pantalla de contraseña nueva se muestra ANTES del guard de
  // sesión. Al validar el código el usuario YA tiene una sesión temporal, así
  // que si esperáramos a `isUserAllowed` la pantalla quedaría inalcanzable.
  const mostrarReset = authScreen === 'reset';

  if (mostrarReset || !isUserAllowed) {
    return (
      <SafeAreaProvider>
        {authScreen === 'login' ? (
          <LoginScreen
            onNavigateToRegister={() => setAuthScreen('register')}
            onExploreAsGuest={() => setIsGuest(true)}
            onForgotPassword={() => setAuthScreen('forgot')}
          />
        ) : authScreen === 'forgot' ? (
          <ForgotPasswordScreen
            onBack={() => setAuthScreen('login')}
            onCodeVerified={() => setAuthScreen('reset')}
          />
        ) : mostrarReset ? (
          <ResetPasswordScreen
            onDone={async () => {
              // Cerramos la sesión temporal de recuperación antes de volver
              // al login, para que entre con la contraseña nueva.
              await supabase.auth.signOut();
              setAuthScreen('login');
            }}
          />
        ) : (
          <RegisterScreen onNavigateToLogin={() => setAuthScreen('login')} />
        )}
      </SafeAreaProvider>
    );
  }

  const userName = isGuest
    ? 'Invitado'
    : session?.user?.user_metadata?.full_name ||
      session?.user?.email?.split('@')[0] ||
      'Usuario';

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {/* Barra superior con opción de salir */}
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <View style={styles.topBarBrand}>
            <View style={styles.topBarLogoRow}>
              <Image source={logo} style={styles.topBarLogo} accessibilityIgnoresInvertColors />
              <Text style={styles.topBarTitle}>
                CoffeeFast{isGuest ? ' (Invitado)' : ''}
              </Text>
            </View>
            <Text style={styles.topBarGreeting}>{userName}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Salir</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Contenido principal según la pestaña activa */}
        <View style={[styles.content, navigating && styles.contentNavigating]}>
          {activeTab === 'cafeterias' &&
            (selectedCafeteria ? (
              <MenuScreen
                cafeteria={selectedCafeteria}
                onAddToCart={addToCart}
                onBack={() => setSelectedCafeteria(null)}
              />
            ) : (
              <CafeteriaListScreen
                serverUserName={userName}
                onSelectCafeteria={handleSelectCafeteria}
              />
            ))}

          {activeTab === 'pedidos' && (
            <PedidosScreen
              userId={isGuest ? null : session?.user?.id}
              onGoToCafeterias={() => handleTabPress('cafeterias')}
              pedidoConfirmado={pedidoConfirmado?.usuarioId === session?.user.id ? pedidoConfirmado : null}
              onConfirmacionVista={() => setPedidoConfirmado(null)}
            />
          )}

          {activeTab === 'carrito' && (
            <CartScreen
              cart={cart}
              codigo={codigo}
              onCodigoChange={setCodigo}
              idCarrito={idCarrito}
              usuarioId={isGuest ? null : session?.user?.id}
              cafeteriaName={cartCafeteria?.nombre}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onCheckout={handleCheckout}
              onBack={() => handleTabPress('cafeterias')}
              paying={paying}
              requiereRecotizar={requiereRecotizar || requiereCotizacion}
              onRecotizar={recotizar}
            />
          )}

{activeTab === 'wallet' && (
            <WalletScreen userId={isGuest ? null : session?.user?.id || null} />
          )}

          {activeTab === 'perfil' && (
            <PerfilScreen
              session={session}
              isGuest={isGuest}
              onLogout={handleLogout}
              onNavigateTab={handleTabPress}
            />
          )}
        </View>

        {/* Barra de navegación inferior (única) */}
        <View style={styles.bottomNavigation}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.navItem}
                activeOpacity={0.7}
                onPress={() => handleTabPress(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.key === 'carrito' && totalProducts > 0
                  ? `${tab.label}, ${totalProducts} productos`
                  : tab.label}
              >
                <View style={[styles.navItemContent, isActive && styles.activeNavItemContent]}>
                    <View style={styles.navIconWrapper}>
                      <AppIcon
                        name={TAB_ICONS[tab.key]}
                        style={[styles.navIcon, isActive && styles.activeNavIcon]}
                      />
                      {tab.key === 'carrito' && totalProducts > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {totalProducts > 99 ? '99+' : totalProducts}
                          </Text>
                        </View>
                      )}
                  </View>
                  <Text
                    style={[
                      styles.navText,
                      isActive && styles.activeNavText,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
  },
  topBar: {
    backgroundColor: '#FAF7F2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DD',
  },
  topBarBrand: {
    flexDirection: 'column',
  },
  topBarLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4A3728',
    fontFamily: 'serif',
  },
  topBarGreeting: {
    fontSize: 11,
    color: '#8C6D58',
    marginTop: 1,
  },
  logoutBtn: {
    backgroundColor: '#F5EBE1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C6D58',
  },
  content: {
    flex: 1,
  },
  contentNavigating: {
    opacity: 0.96,
  },
  bottomNavigation: {
    height: 76,
    backgroundColor: colors.blanco,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 7,
    elevation: 10,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  navItemContent: {
    minWidth: 58,
    height: 58,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeNavItemContent: {
    backgroundColor: colors.cafeOscuro,
    borderRadius: 14,
  },
  navIconWrapper: {
    width: 27,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 19,
    color: colors.textoSecundario,
  },
  activeNavIcon: {
    color: colors.crema,
  },
  navText: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.textoSecundario,
    fontWeight: '500',
  },
  activeNavText: {
    color: colors.blanco,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    right: -7,
    top: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.rojo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.blanco,
  },
  badgeText: {
    color: colors.blanco,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
});
