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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [isGuest, setIsGuest] = useState(false);

  const [selectedCafeteria, setSelectedCafeteria] = useState<Cafeteria | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('cafeterias');
  const [cart, setCart] = useState<CartItem[]>([]);

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
    const user = session?.user;
    const cafeteriaId = selectedCafeteria?.id;

    if (!user) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para confirmar tu pedido.');
      return;
    }

    if (!cafeteriaId || cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos desde el menú de una cafetería.');
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const pedidoPayload: Record<string, unknown> = {
      cafeteria_id: cafeteriaId,
      total,
      estado: 'pendiente',
    };

    const insertPedido = async (
      payload: Record<string, unknown>
    ): Promise<{ id: number } | null> => {
      const { data, error } = await supabase
        .from('pedidos')
        .insert(payload)
        .select()
        .single();
      if (error) return null;
      return data as { id: number };
    };

    let pedido = await insertPedido({ ...pedidoPayload, auth_user_id: user.id });
    if (!pedido) {
      pedido = await insertPedido(pedidoPayload);
    }

    if (!pedido) {
      Alert.alert(
        'No se pudo crear el pedido',
        'Revisa tu conexión e inténtalo nuevamente.'
      );
      return;
    }

    const detalles = cart.map((item) => ({
      pedido_id: pedido!.id,
      producto_id: item.id,
      cantidad: item.quantity,
      precio_unitario: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: detalleError } = await supabase
      .from('detalles_pedido')
      .insert(detalles);

    if (detalleError) {
      Alert.alert('Aviso', 'El pedido se registró, pero el detalle no pudo guardarse.');
      return;
    }

    setCart([]);
    Alert.alert(
      'Pedido creado',
      `Tu pedido fue registrado. Retira en ${selectedCafeteria?.nombre || 'la cafetería seleccionada'} cuando esté listo.`
    );
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

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {/* Barra superior con opción de salir */}
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <Text style={styles.topBarTitle}>
            ☕ CoffeeFast {isGuest ? '(Invitado)' : ''}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Salir</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Contenido principal según la pestaña activa */}
        <View style={styles.content}>
          {activeTab === 'cafeterias' && (
            <CafeteriaListScreen
              selectedCafeteriaId={selectedCafeteria?.id}
              onSelectCafeteria={handleSelectCafeteria}
            />
          )}

          {activeTab === 'cafeterias' && selectedCafeteria && (
            <MenuScreen
              cafeteria={selectedCafeteria}
              onAddToCart={addToCart}
              onBack={() => setSelectedCafeteria(null)}
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
            />
          )}

          {activeTab === 'wallet' && (
            <WalletScreen userId={isGuest ? null : session?.user?.id || null} />
          )}
        </View>

        {/* Barra de navegación inferior */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('cafeterias')}
          >
            <Text
              style={[
                styles.navIcon,
                activeTab === 'cafeterias' && styles.activeNavIcon,
              ]}
            >
              🏪
            </Text>
            <Text
              style={[
                styles.navText,
                activeTab === 'cafeterias' && styles.activeNavText,
              ]}
            >
              Cafeterías
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('pedidos')}
          >
            <Text
              style={[
                styles.navIcon,
                activeTab === 'pedidos' && styles.activeNavIcon,
              ]}
            >
              📋
            </Text>
            <Text
              style={[
                styles.navText,
                activeTab === 'pedidos' && styles.activeNavText,
              ]}
            >
              Pedidos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('carrito')}
          >
            <View>
              <Text
                style={[
                  styles.navIcon,
                  activeTab === 'carrito' && styles.activeNavIcon,
                ]}
              >
                🛒
              </Text>
              {totalProducts > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalProducts}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.navText,
                activeTab === 'carrito' && styles.activeNavText,
              ]}
            >
              Carrito
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('wallet')}
          >
            <Text
              style={[
                styles.navIcon,
                activeTab === 'wallet' && styles.activeNavIcon,
              ]}
            >
              💳
            </Text>
            <Text
              style={[
                styles.navText,
                activeTab === 'wallet' && styles.activeNavText,
              ]}
            >
              Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('perfil')}
          >
            <Text
              style={[
                styles.navIcon,
                activeTab === 'perfil' && styles.activeNavIcon,
              ]}
            >
              👤
            </Text>
            <Text
              style={[
                styles.navText,
                activeTab === 'perfil' && styles.activeNavText,
              ]}
            >
              Perfil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
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
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A3728',
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
    marginBottom: 2,
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
  badge: {
    position: 'absolute',
    right: -10,
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
