import { supabase, isSupabaseConfigured } from './supabaseClient';

const initialMockPedidos = [
  {
    id: '1264-D',
    qr_token: 'QR-1264-D',
    cliente: 'Camila Silva',
    ubicacion: 'Edificio de Ingeniería - Campus Central',
    hora: '08:22 AM',
    hora_retiro: '08:45 AM',
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
    hora_retiro: '09:05 AM',
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
    hora_retiro: '09:25 AM',
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
    hora_retiro: '08:10 AM',
    creado_en: new Date(Date.now() - 65 * 60000).toISOString(),
    total: 4200,
    estado: 'entregado',
    productos: [
      { id: 7, nombre: 'Latte Vainilla', cantidad: 1, detalle: 'Leche de almendras', precio: 2600 },
      { id: 8, nombre: 'Galleta Choco Chips', cantidad: 1, detalle: 'Sin modificaciones', precio: 1600 },
    ],
  },
  {
    id: '1101-X',
    qr_token: 'QR-1101-X',
    cliente: 'Nicolás Pérez',
    ubicacion: 'Facultad de Ingeniería',
    hora: '08:35 AM',
    hora_retiro: '08:55 AM',
    creado_en: new Date(Date.now() - 25 * 60000).toISOString(),
    total: 4900,
    estado: 'pendiente',
    productos: [
      { id: 9, nombre: 'Té Verde', cantidad: 2, detalle: 'Con miel', precio: 1200 },
      { id: 12, nombre: 'Alfajor Artesanal', cantidad: 1, detalle: 'Sin modificaciones', precio: 900 },
      { id: 13, nombre: 'Café con Leche', cantidad: 1, detalle: 'Con sacarina', precio: 1600 },
    ],
  },
  {
    id: '1205-V',
    qr_token: 'QR-1205-V',
    cliente: 'Isabella Ramírez',
    ubicacion: 'Edificio de Derecho',
    hora: '08:50 AM',
    hora_retiro: '09:10 AM',
    creado_en: new Date(Date.now() - 6 * 60000).toISOString(),
    total: 5600,
    estado: 'pendiente',
    productos: [
      { id: 2, nombre: 'Capuchino', cantidad: 1, detalle: 'Leche descremada', precio: 2400 },
      { id: 8, nombre: 'Galleta Choco Chips', cantidad: 2, detalle: 'Sin modificaciones', precio: 1600 },
    ],
  },
  {
    id: '1318-F',
    qr_token: 'QR-1318-F',
    cliente: 'Sebastián Castillo',
    ubicacion: 'Campus San Joaquín',
    hora: '08:55 AM',
    hora_retiro: '09:15 AM',
    creado_en: new Date(Date.now() - 4 * 60000).toISOString(),
    total: 4800,
    estado: 'pendiente',
    productos: [
      { id: 11, nombre: 'Sándwich Vegetal', cantidad: 1, detalle: 'Con mayo', precio: 2600 },
      { id: 14, nombre: 'Jugo Natural', cantidad: 1, detalle: 'De naranja', precio: 2200 },
    ],
  },
  {
    id: '1132-R',
    qr_token: 'QR-1132-R',
    cliente: 'Antonia Soto',
    ubicacion: 'Biblioteca General',
    hora: '08:40 AM',
    hora_retiro: '09:00 AM',
    creado_en: new Date(Date.now() - 30 * 60000).toISOString(),
    total: 6700,
    estado: 'preparando',
    productos: [
      { id: 15, nombre: 'Panini Caprese', cantidad: 1, detalle: 'Calentado', precio: 3400 },
      { id: 1, nombre: 'Café Americano', cantidad: 1, detalle: 'Sin azúcar', precio: 1800 },
      { id: 16, nombre: 'Brownie de Chocolate', cantidad: 1, detalle: 'Para llevar', precio: 1500 },
    ],
  },
  {
    id: '1177-Y',
    qr_token: 'QR-1177-Y',
    cliente: 'Martín Riquelme',
    ubicacion: 'Facultad de Medicina',
    hora: '08:48 AM',
    hora_retiro: '09:08 AM',
    creado_en: new Date(Date.now() - 15 * 60000).toISOString(),
    total: 4000,
    estado: 'preparando',
    productos: [
      { id: 10, nombre: 'Chocolate Caliente', cantidad: 1, detalle: 'Extra chantilly', precio: 2000 },
      { id: 3, nombre: 'Croissant de Jamón y Queso', cantidad: 1, detalle: 'Calentado', precio: 2000 },
    ],
  },
  {
    id: '1044-G',
    qr_token: 'QR-1044-G',
    cliente: 'Fernanda Vásquez',
    ubicacion: 'Edificio de Economía',
    hora: '08:30 AM',
    hora_retiro: '08:52 AM',
    creado_en: new Date(Date.now() - 38 * 60000).toISOString(),
    total: 4800,
    estado: 'preparando',
    productos: [
      { id: 2, nombre: 'Capuchino', cantidad: 2, detalle: 'Leche de almendras', precio: 2400 },
    ],
  },
  {
    id: '1084-S',
    qr_token: 'QR-1084-S',
    cliente: 'Joaquín Díaz',
    ubicacion: 'Facultad de Ciencias',
    hora: '08:20 AM',
    hora_retiro: '08:40 AM',
    creado_en: new Date(Date.now() - 50 * 60000).toISOString(),
    total: 5400,
    estado: 'listo',
    productos: [
      { id: 4, nombre: 'Sándwich Ave Mayo', cantidad: 1, detalle: 'Sin ají', precio: 2800 },
      { id: 7, nombre: 'Latte Vainilla', cantidad: 1, detalle: 'Con hielo', precio: 2600 },
    ],
  },
  {
    id: '1222-L',
    qr_token: 'QR-1222-L',
    cliente: 'Constanza Vera',
    ubicacion: 'Campus Central',
    hora: '08:52 AM',
    hora_retiro: '09:12 AM',
    creado_en: new Date(Date.now() - 12 * 60000).toISOString(),
    total: 3000,
    estado: 'listo',
    productos: [
      { id: 6, nombre: 'Muffin de Arándanos', cantidad: 1, detalle: 'Para llevar', precio: 1800 },
      { id: 9, nombre: 'Té Verde', cantidad: 1, detalle: 'Sin azúcar', precio: 1200 },
    ],
  },
  {
    id: '0960-T',
    qr_token: 'QR-0960-T',
    cliente: 'Benjamín Flores',
    ubicacion: 'Facultad de Artes',
    hora: '07:55 AM',
    hora_retiro: '08:15 AM',
    creado_en: new Date(Date.now() - 80 * 60000).toISOString(),
    total: 3000,
    estado: 'entregado',
    productos: [
      { id: 14, nombre: 'Jugo Natural', cantidad: 1, detalle: 'De durazno', precio: 2200 },
      { id: 5, nombre: 'Empanada de Queso', cantidad: 1, detalle: 'Sin modificaciones', precio: 800 },
    ],
  },
  {
    id: '1156-N',
    qr_token: 'QR-1156-N',
    cliente: 'Amanda Torres',
    ubicacion: 'Edificio de Ingeniería',
    hora: '08:15 AM',
    hora_retiro: '08:35 AM',
    creado_en: new Date(Date.now() - 55 * 60000).toISOString(),
    total: 5800,
    estado: 'entregado',
    productos: [
      { id: 11, nombre: 'Sándwich Vegetal', cantidad: 1, detalle: 'Sin cebolla', precio: 2600 },
      { id: 13, nombre: 'Café con Leche', cantidad: 2, detalle: 'Tibio', precio: 1600 },
    ],
  },
];

const getStoredPedidos = () => {
  const stored = localStorage.getItem('coffeefaster_pedidos_v2');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.error(e); }
  }
  localStorage.setItem('coffeefaster_pedidos_v2', JSON.stringify(initialMockPedidos));
  return initialMockPedidos;
};

const saveStoredPedidos = (pedidos) => {
  localStorage.setItem('coffeefaster_pedidos_v2', JSON.stringify(pedidos));
};

export const pedidosService = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('PEDIDOS')
          .select('*, USUARIOS(nombre, apellido), CAFETERIAS(nombre), DETALLES_PEDIDO(*, PRODUCTOS(nombre, precio))')
          .order('creado_en', { ascending: false });

        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Fallback a datos mock por error en Supabase:', err);
      }
    }
    return getStoredPedidos();
  },

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
