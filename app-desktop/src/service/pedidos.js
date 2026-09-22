import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'pedidos';

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

export const pedidos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), cafeterias(*)')
          .order('creado_en', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Uso de mock para getAll():', e);
      }
    }
    return getStoredPedidos();
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), cafeterias(*), detalles_pedido(*, productos(*))')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Uso de mock para getById():', e);
      }
    }
    const mockList = getStoredPedidos();
    return mockList.find(p => p.id === id) || null;
  },

  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(*), cafeterias(*), detalles_pedido(*, productos(*))')
          .or(`qr_token.eq.${cleanToken},id.eq.${cleanToken}`)
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Uso de mock para getByQrToken():', e);
      }
    }
    const mockList = getStoredPedidos();
    return mockList.find(p => p.qr_token === cleanToken || p.id === cleanToken) || null;
  },

  async updateEstado(id, nuevoEstado) {
    if (isSupabaseConfigured) {
      try {
        const updates = { estado: nuevoEstado };
        if (nuevoEstado === 'preparando') updates.inicio_preparacion_en = new Date().toISOString();
        if (nuevoEstado === 'entregado') updates.completado_en = new Date().toISOString();

        const { data, error } = await supabase
          .from(TABLE)
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Uso de mock para updateEstado():', e);
      }
    }
    const mockList = getStoredPedidos();
    const updated = mockList.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p);
    saveStoredPedidos(updated);
    return updated.find(p => p.id === id);
  },

  async getEstadisticas() {
    const list = await this.getAll();
    const totalVentas = list
      .filter(p => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando')
      .reduce((sum, p) => sum + (p.total || 0), 0);

    return {
      totalVentas,
      totalPedidos: list.length,
      pendientes: list.filter(p => p.estado === 'pendiente').length,
      preparando: list.filter(p => p.estado === 'preparando').length,
      listos: list.filter(p => p.estado === 'listo').length,
      entregados: list.filter(p => p.estado === 'entregado').length,
      tiempoPromedioMin: 6.5,
    };
  }
};

export const pedidosService = pedidos;
export default pedidos;
