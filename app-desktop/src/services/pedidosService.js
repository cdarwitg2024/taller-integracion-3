import { supabase, isSupabaseConfigured } from './supabaseClient';
import { backendApi } from './backendApi';

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
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parseando pedidos de localStorage:', e);
    }
  }
  localStorage.setItem('coffeefaster_pedidos_v2', JSON.stringify(initialMockPedidos));
  return initialMockPedidos;
};

const saveStoredPedidos = (pedidos) => {
  localStorage.setItem('coffeefaster_pedidos_v2', JSON.stringify(pedidos));
};

export function formatearHoraRetiro(valor) {
  if (!valor) return undefined;
  if (typeof valor === 'string' && /(AM|PM)$/i.test(valor.trim())) return valor;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return undefined;
  const h24 = fecha.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function normalizarPedido(fila) {
  if (!fila) return null;

  const rawDetalles = Array.isArray(fila.detalles_pedido)
    ? fila.detalles_pedido
    : (Array.isArray(fila.DETALLES_PEDIDO)
      ? fila.DETALLES_PEDIDO
      : (Array.isArray(fila.productos) ? fila.productos : []));

  const productos = rawDetalles.map((d) => {
    const p = d.productos || d.PRODUCTOS;
    const nombre = (Array.isArray(p) ? p[0]?.nombre : p?.nombre) || d.nombre || 'Producto';
    return {
      id: d.id || d.producto_id,
      nombre,
      cantidad: Number(d.cantidad) || 1,
      detalle: d.nota || d.modificaciones || d.detalle || 'Sin modificaciones',
      precio: Number(d.precio_unitario || d.precio || 0),
    };
  });

  const userObj = fila.usuarios || fila.USUARIOS;
  const clienteNombre =
    fila.cliente ||
    (userObj ? `${userObj.nombre || ''} ${userObj.apellido || ''}`.trim() : 'Cliente General');

  const cafeObj = fila.cafeterias || fila.CAFETERIAS;
  const ubicacionNombre = fila.ubicacion || (cafeObj?.nombre ? cafeObj.nombre : 'Campus Central');

  const idStr = String(fila.codigo_retiro_diario || fila.id);

  return {
    ...fila,
    id: idStr,
    rawId: fila.id,
    codigo_retiro_diario: fila.codigo_retiro_diario || idStr,
    qr_token: fila.qr_token || idStr,
    cliente: clienteNombre,
    ubicacion: ubicacionNombre,
    hora: fila.hora || (fila.creado_en ? formatearHoraRetiro(fila.creado_en) : undefined),
    hora_retiro: formatearHoraRetiro(fila.hora_retiro),
    creado_en: fila.creado_en,
    total: Number(fila.total) || 0,
    estado: fila.estado === 'preparando' ? 'en_preparacion' : fila.estado,
    detalles_pedido: rawDetalles,
    productos,
  };
}

function aMinutosDelDia(horaRetiro) {
  if (!horaRetiro) return null;
  const match = String(horaRetiro).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let horas = Number(match[1]) % 12;
  if (/PM/i.test(match[3])) horas += 12;
  return horas * 60 + Number(match[2]);
}

function aInstanteRetiro(pedido) {
  const minutos = aMinutosDelDia(pedido.hora_retiro);
  if (minutos !== null) return minutos;
  if (pedido.creado_en) {
    const fecha = new Date(pedido.creado_en);
    if (!Number.isNaN(fecha.getTime())) {
      const conAnticipo = new Date(fecha.getTime() + 15 * 60000);
      return conAnticipo.getHours() * 60 + conAnticipo.getMinutes();
    }
  }
  return null;
}

function comparadorPrioridad(a, b) {
  const tA = aInstanteRetiro(a);
  const tB = aInstanteRetiro(b);
  if (tA !== null && tB !== null) {
    if (tA !== tB) return tA - tB;
  } else if (tA !== null) {
    return -1;
  } else if (tB !== null) {
    return 1;
  }
  return new Date(a.creado_en || 0) - new Date(b.creado_en || 0);
}

export function ordenarPedidos(lista) {
  return [...lista].sort(comparadorPrioridad);
}

export const pedidosService = {
  async getAll() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .order('creado_en', { ascending: false });

        if (!error && data && data.length > 0) {
          const normalized = data.map(normalizarPedido);
          saveStoredPedidos(normalized);
          return normalized;
        }
      } catch (err) {
        console.warn('Fallback a datos mock por error en Supabase:', err);
      }
    }
    return getStoredPedidos().map(normalizarPedido);
  },

  async getById(id) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .eq('id', id)
          .single();

        if (!error && data) return normalizarPedido(data);
      } catch (err) {
        console.warn('Fallback a mock para getById:', err);
      }
    }
    const mockList = getStoredPedidos().map(normalizarPedido);
    return mockList.find(p => String(p.id) === String(id) || String(p.rawId) === String(id)) || null;
  },

  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
          .or(`qr_token.eq.${cleanToken},id.eq.${cleanToken},codigo_retiro_diario.eq.${cleanToken}`)
          .single();

        if (!error && data) return normalizarPedido(data);
      } catch (err) {
        console.warn('Fallback a datos mock:', err);
      }
    }

    const mockList = getStoredPedidos().map(normalizarPedido);
    return mockList.find(p => p.qr_token === cleanToken || String(p.id) === cleanToken || p.codigo_retiro_diario === cleanToken) || null;
  },

  async updateEstado(id, nuevoEstado) {
    // 1. Vía MS Comercio (PATCH /pedidos/:id/estado) — valida la secuencia
    //    pendiente -> en_preparacion -> listo en el backend.
    try {
      await backendApi.cambiarEstadoPedido(id, nuevoEstado);
      const updated = await this.getById(id);
      if (updated) return updated;
    } catch (err) {
      console.warn('MS Comercio no disponible, fallback a Supabase directo:', err.message);
    }

    // 2. Fallback: UPDATE directo en Supabase
    if (isSupabaseConfigured) {
      try {
        const updates = { estado: nuevoEstado };
        const now = new Date().toISOString();
        if (nuevoEstado === 'en_preparacion') updates.inicio_preparacion_en = now;
        if (nuevoEstado === 'listo') updates.listo_en = now;
        if (nuevoEstado === 'entregado') {
          updates.entregado_en = now;
          updates.completado_en = now;
        }
        if (nuevoEstado === 'cancelado') updates.cancelado_en = now;

        const { data, error } = await supabase
          .from('pedidos')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return normalizarPedido(data);
        if (error) throw error;
      } catch (err) {
        console.warn('Fallback a mock:', err);
      }
    }

    const mockList = getStoredPedidos();
    const updated = mockList.map(p => (String(p.id) === String(id) ? { ...p, estado: nuevoEstado } : p));
    saveStoredPedidos(updated);
    return normalizarPedido(updated.find(p => String(p.id) === String(id)));
  },

  async getEstadisticas() {
    const pedidos = await this.getAll();
    const totalVentas = pedidos
      .filter(p => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando')
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const preparando = pedidos.filter(p => p.estado === 'preparando').length;
    const listos = pedidos.filter(p => p.estado === 'listo').length;
    const entregados = pedidos.filter(p => p.estado === 'entregado').length;

    const tiempos = pedidos
      .filter(p => p.tiempo_real_min && Number(p.tiempo_real_min) > 0)
      .map(p => Number(p.tiempo_real_min));
    const tiempoPromedioMin = tiempos.length > 0
      ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1))
      : 6.5;

    return {
      totalVentas,
      totalPedidos: pedidos.length,
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
      const items = p.productos || p.detalles_pedido || [];
      items.forEach((item) => {
        const name = item.nombre || item.productos?.nombre || 'Producto';
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
  },
};

export const pedidos = pedidosService;
export default pedidosService;
