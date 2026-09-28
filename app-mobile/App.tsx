import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { CafeteriaListScreen } from './src/screens/CafeteriaListScreen';
import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';
import PedidosScreen from './src/screens/PedidosScreen';
import WalletScreen from './src/screens/WalletScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import { Cafeteria } from './src/types/cafeteria';

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  emoji: string;
  available: boolean;
};

type CartItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  emoji: string;
  quantity: number;
};

type AppTab = 'cafeterias' | 'pedidos' | 'carrito' | 'wallet' | 'perfil';

/**
 * Respuesta de la RPC `procesar_pago` (ver database/fixes/crear_rpc_pagos.sql).
 * Modela los dos caminos: aprobado y rechazado, con los campos que la app
 * necesita mostrarle al usuario.
 */
type PagoResult = {
  ok: boolean;
  motivo?: string;
  mensaje?: string;
  saldo_disponible?: number;
  total?: number;
  faltante?: number;
  pedido_id?: number;
  saldo_restante?: number;
  estado?: string;
  pago_estado?: string;
};

const TABS: { key: AppTab; label: string }[] = [
  { key: 'cafeterias', label: 'Cafeterías' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'carrito', label: 'Carrito' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'perfil', label: 'Perfil' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [isGuest, setIsGuest] = useState(false);

  const [selectedCafeteria, setSelectedCafeteria] = useState<Cafeteria | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('cafeterias');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
            setSelectedCafeteria(null);
            setCart([]);
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

  const handleTabPress = (tab: AppTab) => {
    if (tab === 'cafeterias') {
      setSelectedCafeteria(null);
    }
    setActiveTab(tab);
  };

  const addToCart = (product: Product) => {
    if (!product.available) {
      return;
    }

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
          emoji: product.emoji,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (id: number) => {
    setCart((currentCart: CartItem[]) =>
      currentCart.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (id: number) => {
    setCart((currentCart: CartItem[]) =>
      currentCart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart((currentCart: CartItem[]) =>
      currentCart.filter((item) => item.id !== id)
    );
  };

  const handleCheckout = async () => {
    const cafeteriaId = selectedCafeteria?.id;

    if (!session?.user) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para confirmar tu pedido.');
      return;
    }

    if (!cafeteriaId || cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos desde el menú de una cafetería.');
      return;
    }

    // Guardia de reentrada: dos toques antes de que resuelva la RPC intentarian
    // cobrar dos veces. El UNIQUE en pagos.pedido_id es la red real, pero esto
    // evita siquiera intentarlo.
    if (paying) return;
    setPaying(true);

    const formatCLP = (valor: number) => `$${Number(valor).toLocaleString('es-CL')}`;

    try {
      // El total NO se manda. La RPC lo recalcula desde productos.precio: si
      // se enviara, un cliente podria pagar $100 un sándwich de $2.000.
      const { data, error } = await supabase.rpc('procesar_pago', {
        p_cafeteria_id: cafeteriaId,
        p_items: cart.map((item) => ({
          producto_id: item.id,
          cantidad: item.quantity,
        })),
      });

      if (error) {
        Alert.alert(
          'No se pudo procesar el pago',
          'Revisa tu conexión e inténtalo nuevamente.'
        );
        return;
      }

      const resultado = data as PagoResult | null;

      if (!resultado || !resultado.ok) {
        if (resultado?.motivo === 'saldo_insuficiente') {
          // Carrito intacto a proposito: el usuario recarga y reintenta.
          Alert.alert(
            'Saldo insuficiente en la Wallet',
            `Tu pedido cuesta ${formatCLP(resultado.total ?? 0)} y te ` +
              `faltan ${formatCLP(resultado.faltante ?? 0)}.\n` +
              `Saldo actual: ${formatCLP(resultado.saldo_disponible ?? 0)}.`
          );
        } else {
          Alert.alert(
            'Pago rechazado',
            resultado?.mensaje || 'No fue posible procesar el pago.'
          );
        }
        return;
      }

      // Solo aca se vacia el carrito: el pago se aprobo y el saldo se debito.
      setCart([]);
      Alert.alert(
        'Pago aprobado',
        `Tu pedido fue pagado con Wallet.\n` +
          `Saldo restante: ${formatCLP(Number(resultado.saldo_restante ?? 0))}.`
      );
    } catch (e) {
      Alert.alert(
        'No se pudo procesar el pago',
        'Ocurrio un error inesperado. Intentalo nuevamente.'
      );
    } finally {
      setPaying(false);
    }
  };

  const totalProducts = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A3728" />
      </View>
    );
  }

  const isUserAllowed = Boolean((session && session.user) || isGuest);

  if (!isUserAllowed) {
    return (
      <SafeAreaProvider>
        {authScreen === 'login' ? (
          <LoginScreen
            onNavigateToRegister={() => setAuthScreen('register')}
            onExploreAsGuest={() => setIsGuest(true)}
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
            <Text style={styles.topBarTitle}>
              ☕ CoffeeFast{isGuest ? ' (Invitado)' : ''}
            </Text>
            <Text style={styles.topBarGreeting}>{userName}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Salir</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Contenido principal según la pestaña activa */}
        <View style={styles.content}>
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
            />
          )}

          {activeTab === 'carrito' && (
            <CartScreen
              cart={cart}
              cafeteriaName={selectedCafeteria?.nombre || 'Cafetería Central'}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
            onRemove={removeFromCart}
            onCheckout={handleCheckout}
            paying={paying}
          />
          )}

{activeTab === 'wallet' && (
            <WalletScreen userId={isGuest ? null : session?.user?.id || null} />
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
              >
                <View>
                  <Text
                    style={[
                      styles.navIcon,
                      isActive && styles.activeNavIcon,
                    ]}
                  >
                    {tab.key === 'cafeterias' && '🏪'}
                    {tab.key === 'pedidos' && '📋'}
                    {tab.key === 'carrito' && '🛒'}
                    {tab.key === 'wallet' && '💳'}
                    {tab.key === 'perfil' && '👤'}
                  </Text>
                  <Text
                    style={[
                      styles.navText,
                      isActive && styles.activeNavText,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {tab.key === 'carrito' && totalProducts > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{totalProducts}</Text>
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.navIndicator,
                    isActive && styles.activeNavIndicator,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaProvider>
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
  bottomNavigation: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE8E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 20,
  },
  activeNavIcon: {
    opacity: 1,
  },
  navText: {
    fontSize: 11,
    color: '#A39A96',
  },
  activeNavText: {
    color: '#4A332C',
    fontWeight: '700',
  },
  navIndicator: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 3,
  },
  activeNavIndicator: {
    backgroundColor: '#4A332C',
  },
  badge: {
    position: 'absolute',
    right: -12,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E65100',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});