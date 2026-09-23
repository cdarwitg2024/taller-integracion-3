import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'pedidos';

const initialMockPedidos = [
  {
    id: 1264,
    codigo_retiro_diario: '1264-D',
    qr_token: 'QR-1264-D',
    cliente: 'Camila Silva',
    ubicacion: 'Edificio de Ingeniería - Campus Central',
    hora: '08:22 AM',
    creado_en: new Date(Date.now() - 35 * 60000).toISOString(),
    total: 6200,
    estado: 'pendiente',
    pago_estado: 'pagado',
    usuarios: { nombre: 'Camila', apellido: 'Silva' },
    cafeterias: { nombre: 'Edificio de Ingeniería - Campus Central' },
    detalles_pedido: [
      { id: 1, cantidad: 1, nota: 'Sin azúcar', precio_unitario: 1800, subtotal: 1800, productos: { nombre: 'Café Americano', precio: 1800 } },
      { id: 2, cantidad: 1, nota: 'Leche descremada', precio_unitario: 2400, subtotal: 2400, productos: { nombre: 'Capuchino', precio: 2400 } },
      { id: 3, cantidad: 1, nota: 'Calentado', precio_unitario: 2000, subtotal: 2000, productos: { nombre: 'Croissant Jamón Queso', precio: 2000 } },
    ],
  },
  {
    id: 777,
    codigo_retiro_diario: '0777-W',
    qr_token: 'QR-0777-W',
    cliente: 'Tomás Vargas',
    ubicacion: 'Facultad de Medicina',
    hora: '08:45 AM',
    creado_en: new Date(Date.now() - 20 * 60000).toISOString(),
    total: 5100,
    estado: 'preparando',
    pago_estado: 'pagado',
    usuarios: { nombre: 'Tomás', apellido: 'Vargas' },
    cafeterias: { nombre: 'Facultad de Medicina' },
    detalles_pedido: [
      { id: 4, cantidad: 1, nota: 'Sin ají', precio_unitario: 2800, subtotal: 2800, productos: { nombre: 'Sándwich Ave Mayo', precio: 2800 } },
      { id: 1, cantidad: 1, nota: 'Dos azúcares', precio_unitario: 1500, subtotal: 1500, productos: { nombre: 'Café Americano', precio: 1500 } },
      { id: 5, cantidad: 1, nota: 'Sin modificaciones', precio_unitario: 800, subtotal: 800, productos: { nombre: 'Empanada de Queso', precio: 800 } },
    ],
  },
  {
    id: 912,
    codigo_retiro_diario: '0912-K',
    qr_token: 'QR-0912-K',
    cliente: 'Valentina Rojas',
    ubicacion: 'Biblioteca General',
    hora: '09:05 AM',
    creado_en: new Date(Date.now() - 10 * 60000).toISOString(),
    total: 3600,
    estado: 'listo',
    pago_estado: 'pagado',
    usuarios: { nombre: 'Valentina', apellido: 'Rojas' },
    cafeterias: { nombre: 'Biblioteca General' },
    detalles_pedido: [
      { id: 6, cantidad: 2, nota: 'Para llevar', precio_unitario: 1800, subtotal: 3600, productos: { nombre: 'Muffin de Arándanos', precio: 1800 } },
    ],
  },
  {
    id: 431,
    codigo_retiro_diario: '0431-M',
    qr_token: 'QR-0431-M',
    cliente: 'Mateo Fernández',
    ubicacion: 'Edificio de Economía',
    hora: '07:50 AM',
    creado_en: new Date(Date.now() - 65 * 60000).toISOString(),
    total: 4200,
    estado: 'entregado',
    pago_estado: 'pagado',
    usuarios: { nombre: 'Mateo', apellido: 'Fernández' },
    cafeterias: { nombre: 'Edificio de Economía' },
    detalles_pedido: [
      { id: 7, cantidad: 1, nota: 'Leche de almendras', precio_unitario: 2600, subtotal: 2600, productos: { nombre: 'Latte Vainilla', precio: 2600 } },
      { id: 8, cantidad: 1, nota: 'Sin modificaciones', precio_unitario: 1600, subtotal: 1600, productos: { nombre: 'Galleta Choco Chips', precio: 1600 } },
    ],
  },
];

const getStoredPedidos = () => {
  try {
    const stored = localStorage.getItem('coffeefaster_pedidos');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error al leer pedidos de localStorage:', err);
  }
  localStorage.setItem('coffeefaster_pedidos', JSON.stringify(initialMockPedidos));
  return initialMockPedidos;
};

const saveStoredPedidos = (pedidos) => {
  try {
    localStorage.setItem('coffeefaster_pedidos', JSON.stringify(pedidos));
  } catch (err) {
    console.error('Error al guardar pedidos en localStorage:', err);
  }
};

export const pedidos = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .order('creado_en', { ascending: false });

        if (!error && data && data.length > 0) {
          saveStoredPedidos(data);
          return data;
        }
      } catch (err) {
        console.warn('Fallback a mock para pedidos.getAll():', err);
      }
    }
    return getStoredPedidos();
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .eq('id', id)
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a mock para pedidos.getById():', err);
      }
    }
    const list = getStoredPedidos();
    return list.find((p) => String(p.id) === String(id)) || null;
  },

  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .or(`qr_token.eq.${cleanToken},codigo_retiro_diario.eq.${cleanToken}`)
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Fallback a mock para pedidos.getByQrToken():', err);
      }
    }
    const list = getStoredPedidos();
    return list.find((p) => p.qr_token === cleanToken || p.codigo_retiro_diario === cleanToken || String(p.id) === cleanToken) || null;
  },

  async updateEstado(id, nuevoEstado) {
    if (isSupabaseConfigured) {
      // 1. Intentar llamar a la función almacenada cambiar_estado_pedido
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('cambiar_estado_pedido', {
          p_pedido_id: Number(id),
          p_nuevo_estado: nuevoEstado,
        });

        if (!rpcError && rpcData) {
          return this.getById(id);
        }
      } catch (err) {
        console.warn('RPC cambiar_estado_pedido no disponible, ejecutando UPDATE directo:', err);
      }

      // 2. Fallback de UPDATE directo respetando columnas del schema
      try {
        const updates = { estado: nuevoEstado };
        const now = new Date().toISOString();
        if (nuevoEstado === 'preparando') updates.inicio_preparacion_en = now;
        if (nuevoEstado === 'listo') updates.listo_en = now;
        if (nuevoEstado === 'entregado') updates.entregado_en = now;
        if (nuevoEstado === 'cancelado') updates.cancelado_en = now;

        const { data, error } = await supabase
          .from(TABLE)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Error al actualizar estado en Supabase:', err);
      }
    }

    const list = getStoredPedidos();
    const updated = list.map((p) => (String(p.id) === String(id) ? { ...p, estado: nuevoEstado } : p));
    saveStoredPedidos(updated);
    return updated.find((p) => String(p.id) === String(id));
  },

  async getEstadisticas() {
    const list = await this.getAll();
    const totalVentas = list
      .filter((p) => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando')
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const pendientes = list.filter((p) => p.estado === 'pendiente').length;
    const preparando = list.filter((p) => p.estado === 'preparando').length;
    const listos = list.filter((p) => p.estado === 'listo').length;
    const entregados = list.filter((p) => p.estado === 'entregado').length;

    // Calcular tiempo promedio real si está registrado en tiempo_real_min
    const tiempos = list
      .filter((p) => p.tiempo_real_min && Number(p.tiempo_real_min) > 0)
      .map((p) => Number(p.tiempo_real_min));
    const tiempoPromedioMin = tiempos.length > 0
      ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1))
      : 6.5;

    return {
      totalVentas,
      totalPedidos: list.length,
      pendientes,
      preparando,
      listos,
      entregados,
      tiempoPromedioMin,
    };
  },

  async getVentasPorHora() {
    const list = await this.getAll();
    const hourlyMap = {};

    list.forEach((p) => {
      const date = p.creado_en ? new Date(p.creado_en) : new Date();
      const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
      if (!hourlyMap[hourStr]) {
        hourlyMap[hourStr] = { hora: hourStr, ventas: 0, pedidos: 0 };
      }
      hourlyMap[hourStr].ventas += Number(p.total || 0);
      hourlyMap[hourStr].pedidos += 1;
    });

    const result = Object.values(hourlyMap).sort((a, b) => a.hora.localeCompare(b.hora));
    if (result.length > 0) return result;

    return [
      { hora: '08:00', ventas: 12400, pedidos: 5 },
      { hora: '09:00', ventas: 28500, pedidos: 12 },
      { hora: '10:00', ventas: 42000, pedidos: 18 },
      { hora: '11:00', ventas: 31000, pedidos: 14 },
      { hora: '12:00', ventas: 54000, pedidos: 22 },
      { hora: '13:00', ventas: 68000, pedidos: 29 },
      { hora: '14:00', ventas: 38000, pedidos: 15 },
      { hora: '15:00', ventas: 26000, pedidos: 11 },
    ];
  },

  async getTopProductos() {
    const list = await this.getAll();
    const productCountMap = {};

    list.forEach((p) => {
      const items = p.detalles_pedido || [];
      items.forEach((item) => {
        const name = item.productos?.nombre || item.nombre || 'Producto';
        const qty = Number(item.cantidad) || 1;
        productCountMap[name] = (productCountMap[name] || 0) + qty;
      });
    });

    const result = Object.entries(productCountMap)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    if (result.length > 0) return result;

    return [
      { nombre: 'Café Americano', cantidad: 48 },
      { nombre: 'Capuchino', cantidad: 41 },
      { nombre: 'Sándwich Ave', cantidad: 35 },
      { nombre: 'Croissant J&Q', cantidad: 29 },
      { nombre: 'Muffin Arándano', cantidad: 22 },
    ];
  }
};

export const pedidosService = pedidos;
export default pedidos;
