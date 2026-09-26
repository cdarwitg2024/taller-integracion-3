import { supabase, isSupabaseConfigured } from './supabase';
import { parsearFecha, formatearHoraBucket } from '../utils/dateUtils';

const TABLE = 'pedidos';

export const pedidos = {
  async getAll() {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al obtener pedidos desde Supabase:', error);
      throw error;
    }
    return data || [];
  },

  async getById(id) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener pedido por ID desde Supabase:', error);
      throw error;
    }
    return data;
  },

  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .or(`qr_token.eq.${cleanToken},codigo_retiro_diario.eq.${cleanToken}`)
      .single();

    if (error) {
      console.error('Error al obtener pedido por QR token desde Supabase:', error);
      throw error;
    }
    return data;
  },

  async updateEstado(id, nuevoEstado) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
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
    const updates = { estado: nuevoEstado };
    const now = new Date().toISOString();
    if (nuevoEstado === 'preparando' || nuevoEstado === 'en_preparacion') updates.inicio_preparacion_en = now;
    if (nuevoEstado === 'listo') updates.listo_en = now;
    if (nuevoEstado === 'entregado') updates.entregado_en = now;
    if (nuevoEstado === 'cancelado') updates.cancelado_en = now;

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar estado en Supabase:', error);
      throw error;
    }
    return data;
  },

  async getEstadisticas() {
    const list = await this.getAll();
    const totalVentas = list
      .filter((p) => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando' || p.estado === 'en_preparacion')
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const pendientes = list.filter((p) => p.estado === 'pendiente').length;
    const preparando = list.filter((p) => p.estado === 'preparando' || p.estado === 'en_preparacion').length;
    const listos = list.filter((p) => p.estado === 'listo').length;
    const entregados = list.filter((p) => p.estado === 'entregado').length;

    const tiempos = list
      .filter((p) => p.tiempo_real_min && Number(p.tiempo_real_min) > 0)
      .map((p) => Number(p.tiempo_real_min));
    const tiempoPromedioMin = tiempos.length > 0
      ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1))
      : 0;

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
    const hoyStr = new Date().toDateString();
    const pedidosHoy = list.filter((p) => {
      const f = parsearFecha(p.creado_en);
      return f && f.toDateString() === hoyStr;
    });

    // Si hay pedidos en la jornada de hoy usamos hoy; si no (ej. datos de prueba en otra fecha), usamos el total disponible
    const pedidosParaGrafico = pedidosHoy.length > 0 ? pedidosHoy : list;

    const now = new Date();
    const currentHour = now.getHours();

    // El gráfico va según la hora actual en formato estándar 24hrs (desde apertura 08:00 hasta la hora actual)
    let startHour = Math.min(8, currentHour);
    let endHour = currentHour;

    // Ajustar si existen pedidos antes de las 8 o con hora posterior
    pedidosParaGrafico.forEach((p) => {
      const fecha = parsearFecha(p.creado_en);
      if (fecha) {
        const h = fecha.getHours();
        if (h < startHour) startHour = h;
        if (h > endHour) endHour = h;
      }
    });

    // Inicializar todos los tramos horarios en 0 para evitar quiebres o curvas vacías
    const hourlyMap = {};
    for (let h = startHour; h <= endHour; h++) {
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      hourlyMap[hourStr] = { hora: hourStr, ventas: 0, pedidos: 0 };
    }

    // Acumular ventas y cantidad de pedidos por tramo horario (excluyendo cancelados)
    pedidosParaGrafico.forEach((p) => {
      if (p.estado === 'cancelado') return;
      const hourStr = formatearHoraBucket(p.creado_en);
      if (hourStr && hourlyMap[hourStr]) {
        hourlyMap[hourStr].ventas += Number(p.total || 0);
        hourlyMap[hourStr].pedidos += 1;
      }
    });

    return Object.values(hourlyMap).sort((a, b) => a.hora.localeCompare(b.hora));
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

    return Object.entries(productCountMap)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }
};

export const pedidosService = pedidos;
export default pedidos;
