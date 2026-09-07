import { supabase, isSupabaseConfigured } from './supabaseClient';

// Datos de prueba iniciales interactivos para prototipo en vivo
const initialMockPedidos = [
  {
    id: '1264-D',
    qr_token: 'QR-1264-D',
    cliente: 'Camila Silva',
    ubicacion: 'Edificio de Ingeniería - Campus Central',
    hora: '08:22 AM',
    creado_en: new Date(Date.now() - 35 * 60000).toISOString(),
    total: 6200,
    estado: 'pendiente',
    productos: [
      { id: 1, nombre: 'Café Americano', cantidad: 1, detalle: 'Sin azúcar', precio: 1800 },
      { id: 2, nombre: 'Capuchino', cantidad: 1, detalle: 'Leche descremada', precio: 2400 },
      { id: 3, nombre: 'Croissant de Jamón y Queso', cantidad: 1, detalle: 'Calentado', precio: 2000 },
    ],
  },
  {
    id: '0777-W',
    qr_token: 'QR-0777-W',
    cliente: 'Tomás Vargas',
    ubicacion: 'Facultad de Medicina',
    hora: '08:45 AM',
    creado_en: new Date(Date.now() - 20 * 60000).toISOString(),
    total: 5100,
    estado: 'preparando',
    productos: [
      { id: 4, nombre: 'Sándwich Ave Mayo', cantidad: 1, detalle: 'Sin ají', precio: 2800 },
      { id: 1, nombre: 'Café Americano (Mediano)', cantidad: 1, detalle: 'Dos azúcares', precio: 1500 },
      { id: 5, nombre: 'Empanada de Queso', cantidad: 1, detalle: 'Sin modificaciones', precio: 800 },
    ],
  },
  {
    id: '0912-K',
    qr_token: 'QR-0912-K',
    cliente: 'Valentina Rojas',
    ubicacion: 'Biblioteca General',
    hora: '09:05 AM',
    creado_en: new Date(Date.now() - 10 * 60000).toISOString(),
    total: 3600,
    estado: 'listo',
    productos: [
      { id: 6, nombre: 'Muffin de Arándanos', cantidad: 2, detalle: 'Para llevar', precio: 1800 },
    ],
  },
  {
    id: '0431-M',
    qr_token: 'QR-0431-M',
    cliente: 'Mateo Fernández',
    ubicacion: 'Edificio de Economía',
    hora: '07:50 AM',
    creado_en: new Date(Date.now() - 65 * 60000).toISOString(),
    total: 4200,
    estado: 'entregado',
    productos: [
      { id: 7, nombre: 'Latte Vainilla', cantidad: 1, detalle: 'Leche de almendras', precio: 2600 },
      { id: 8, nombre: 'Galleta Choco Chips', cantidad: 1, detalle: 'Sin modificaciones', precio: 1600 },
    ],
  },
];

// Helper para almacenar en localStorage durante la sesión de prueba
const getStoredPedidos = () => {
  const stored = localStorage.getItem('coffeefaster_pedidos');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.error(e); }
  }
  localStorage.setItem('coffeefaster_pedidos', JSON.stringify(initialMockPedidos));
  return initialMockPedidos;
};

const saveStoredPedidos = (pedidos) => {
  localStorage.setItem('coffeefaster_pedidos', JSON.stringify(pedidos));
};

export const pedidosService = {
  /**
   * Obtiene todos los pedidos
   */
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('PEDIDOS')
          .select('*, USUARIOS(nombre, apellido), CAFETERIAS(nombre), DETALLES_PEDIDO(*, PRODUCTOS(nombre, precio))')
          .order('creado_en', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a datos mock por error en Supabase:', err);
      }
    }
    return getStoredPedidos();
  },

  /**
   * Obtiene un pedido por su token QR o ID
   */
  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('PEDIDOS')
          .select('*, USUARIOS(nombre, apellido), DETALLES_PEDIDO(*, PRODUCTOS(nombre, precio))')
          .or(`qr_token.eq.${cleanToken},id.eq.${cleanToken}`)
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a datos mock:', err);
      }
    }

    const mockList = getStoredPedidos();
    return mockList.find(p => p.qr_token === cleanToken || p.id === cleanToken) || null;
  },

  /**
   * Actualiza el estado de un pedido ('pendiente', 'preparando', 'listo', 'entregado')
   */
  async updateEstado(id, nuevoEstado) {
    if (isSupabaseConfigured) {
      try {
        const updates = { estado: nuevoEstado };
        if (nuevoEstado === 'preparando') updates.inicio_preparacion_en = new Date().toISOString();
        if (nuevoEstado === 'entregado') updates.completado_en = new Date().toISOString();

        const { data, error } = await supabase
          .from('PEDIDOS')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a mock:', err);
      }
    }

    const mockList = getStoredPedidos();
    const updated = mockList.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p);
    saveStoredPedidos(updated);
    return updated.find(p => p.id === id);
  },

  /**
   * Resumen de estadísticas para el Dashboard
   */
  async getEstadisticas() {
    const pedidos = await this.getAll();
    const totalVentas = pedidos
      .filter(p => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando')
      .reduce((sum, p) => sum + (p.total || 0), 0);

    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const preparando = pedidos.filter(p => p.estado === 'preparando').length;
    const listos = pedidos.filter(p => p.estado === 'listo').length;
    const entregados = pedidos.filter(p => p.estado === 'entregado').length;

    return {
      totalVentas,
      totalPedidos: pedidos.length,
      pendientes,
      preparando,
      listos,
      entregados,
      tiempoPromedioMin: 6.5,
    };
  }
};

export default pedidosService;
