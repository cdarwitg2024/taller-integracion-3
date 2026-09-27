import { supabase, isSupabaseConfigured } from './supabaseClient';
import { backendApi, CAFETERIA_ID } from './backendApi';
import { parsearFecha, formatearHora, formatearHoraBucket } from '../utils/dateUtils';

export function normalizarTokenQR(texto) {
  let token = String(texto || '').trim().replace(/^["']+|["']+$/g, '');
  if (/^https?:\/\//i.test(token)) {
    const partes = token.split('/').filter(Boolean);
    token = partes[partes.length - 1] || token;
  }
  return token;
}

export function formatearHoraRetiro(valor) {
  return formatearHora(valor);
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
    hora: fila.hora || (fila.creado_en ? formatearHora(fila.creado_en) : undefined),
    hora_retiro: formatearHora(fila.hora_retiro),
    creado_en: fila.creado_en,
    total: Number(fila.total) || 0,
    estado: fila.estado === 'preparando' ? 'en_preparacion' : fila.estado,
    detalles_pedido: rawDetalles,
    productos,
  };
}

function aMinutosDelDia(horaRetiro) {
  if (!horaRetiro) return null;
  const str = String(horaRetiro).trim();
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let horas = Number(match12[1]) % 12;
    if (/PM/i.test(match12[3])) horas += 12;
    return horas * 60 + Number(match12[2]);
  }
  const match24 = str.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return Number(match24[1]) * 60 + Number(match24[2]);
  }
  return null;
}

function aInstanteRetiro(pedido) {
  const minutos = aMinutosDelDia(pedido.hora_retiro);
  if (minutos !== null) return minutos;
  if (pedido.creado_en) {
    const fecha = parsearFecha(pedido.creado_en);
    if (fecha) {
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
  const fA = parsearFecha(a?.creado_en);
  const fB = parsearFecha(b?.creado_en);
  return (fA ? fA.getTime() : 0) - (fB ? fB.getTime() : 0);
}

export function ordenarPedidos(lista) {
  return [...lista].sort(comparadorPrioridad);
}

const TRANSICIONES_VALIDAS = {
  pendiente: new Set(['en_preparacion', 'cancelado']),
  en_preparacion: new Set(['listo', 'cancelado']),
  listo: new Set(['entregado']),
};

export function esTransicionValida(estadoActual, estadoNuevo) {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual];
  return Boolean(permitidos && permitidos.has(estadoNuevo));
}

export const pedidosService = {
  async getAll({ cafeteriaId } = {}) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    let query = supabase
      .from('pedidos')
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))');

    if (cafeteriaId) query = query.eq('cafeteria_id', cafeteriaId);

    const { data, error } = await query.order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al obtener pedidos desde Supabase:', error);
      throw error;
    }
    return (data || []).map(normalizarPedido);
  },

  async getById(id) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener pedido por ID desde Supabase:', error);
      throw error;
    }
    return data ? normalizarPedido(data) : null;
  },

  async getByQrToken(qrToken) {
    if (!qrToken) return null;
    const cleanToken = qrToken.trim();

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }
    const orClauses = [`qr_token.eq.${cleanToken}`, `codigo_retiro_diario.eq.${cleanToken}`];
    if (/^\d+$/.test(cleanToken)) orClauses.push(`id.eq.${cleanToken}`);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .or(orClauses.join(','))
      .maybeSingle();

    if (error) {
      console.error('Error al obtener pedido por QR token desde Supabase:', error);
      throw error;
    }
    return data ? normalizarPedido(data) : null;
  },

  async updateEstado(id, nuevoEstado) {
    // 0. Regla de flujo: no se puede saltar estados
    //    (pendiente -> en_preparacion -> listo -> entregado).
    const actual = await this.getById(id);
    if (actual && !esTransicionValida(actual.estado, nuevoEstado)) {
      console.warn(`Transición inválida de estado: ${actual.estado} -> ${nuevoEstado} (pedido ${id})`);
      return actual;
    }

    // 1. Vía MS Comercio (PATCH /pedidos/:id/estado) — valida la secuencia
    //    pendiente -> en_preparacion -> listo en el backend.
    try {
      await backendApi.cambiarEstadoPedido(id, nuevoEstado);
      const updated = await this.getById(id);
      if (updated) return updated;
    } catch (err) {
      console.warn('MS Comercio no disponible, intentando Supabase directo:', err.message);
    }

    // 2. Fallback: UPDATE directo en Supabase
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }

    const updates = { estado: nuevoEstado };
    const now = new Date().toISOString();
    if (nuevoEstado === 'en_preparacion' || nuevoEstado === 'preparando') updates.inicio_preparacion_en = now;
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
      .select('*, usuarios(nombre, apellido), cafeterias(nombre), detalles_pedido(*, productos(nombre, precio))')
      .single();

    if (error) {
      console.error('Error al actualizar estado del pedido en Supabase:', error);
      throw error;
    }
    return normalizarPedido(data);
  },

  async validarQrEntrega(textoQr) {
    const token = normalizarTokenQR(textoQr);
    if (!token) return { valido: false, razon: 'QR vacío o ilegible, intenta nuevamente.' };

    try {
      const pedido = await this.getByQrToken(token);
      if (!pedido) {
        await this._registrarLogValidacion({ qrToken: token, resultado: 'rechazado', detalle: 'QR no reconocido.' });
        return { valido: false, razon: 'QR no reconocido. Verifica que corresponda a un pedido de CofeeFaster.' };
      }
      if (Number(pedido.cafeteria_id) !== CAFETERIA_ID) {
        const razon = `El pedido #${pedido.id} no pertenece a esta cafetería.`;
        await this._registrarLogValidacion({ pedidoId: pedido.rawId ?? pedido.id, qrToken: token, resultado: 'rechazado', detalle: razon });
        return { valido: false, razon };
      }
      if (pedido.estado === 'entregado') {
        const razon = `El pedido #${pedido.id} ya fue entregado.`;
        await this._registrarLogValidacion({ pedidoId: pedido.rawId ?? pedido.id, qrToken: token, resultado: 'rechazado', detalle: razon });
        return { valido: false, razon };
      }
      if (pedido.estado !== 'listo') {
        const razon = `El pedido #${pedido.id} aún no está listo para retiro (estado: ${pedido.estado}).`;
        await this._registrarLogValidacion({ pedidoId: pedido.rawId ?? pedido.id, qrToken: token, resultado: 'rechazado', detalle: razon });
        return { valido: false, razon };
      }

      const entregado = await this.updateEstado(pedido.rawId ?? pedido.id, 'entregado');
      if (!entregado || entregado.estado !== 'entregado') {
        const razon = `El pedido #${pedido.id} no pudo marcarse como entregado.`;
        await this._registrarLogValidacion({ pedidoId: pedido.rawId ?? pedido.id, qrToken: token, resultado: 'rechazado', detalle: razon });
        return { valido: false, razon };
      }
      await this._registrarLogValidacion({
        pedidoId: pedido.rawId ?? pedido.id,
        qrToken: token,
        resultado: 'entregado',
        detalle: `Pedido #${pedido.id} marcado como entregado por QR/Token.`,
      });
      return {
        valido: true,
        mensaje: 'Entrega validada exitosamente. ¡Qué disfrute su pedido!',
        pedido: entregado,
      };
    } catch (err) {
      console.warn('validarQrEntrega:', err);
      await this._registrarLogValidacion({ qrToken: token, resultado: 'error', detalle: 'No se pudo validar el QR en este momento.' });
      return { valido: false, razon: 'No se pudo validar el QR en este momento.' };
    }
  },

  async _registrarLogValidacion({ pedidoId = null, qrToken = null, resultado, detalle }) {
    if (!isSupabaseConfigured) return;
    try {
      let usuarioId = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        usuarioId = usuario?.id ?? null;
      }
      const { error } = await supabase
        .from('logs_validacion_qr')
        .insert({
          pedido_id: pedidoId,
          cafeteria_id: CAFETERIA_ID,
          usuario_id: usuarioId,
          qr_token: qrToken,
          resultado,
          detalle,
        });
      if (error) console.warn('_registrarLogValidacion:', error?.message);
    } catch (err) {
      console.warn('_registrarLogValidacion:', err?.message || err);
    }
  },

  async getEstadisticas() {
    const pedidos = await this.getAll();
    const totalVentas = pedidos
      .filter(p => p.estado === 'entregado' || p.estado === 'listo' || p.estado === 'preparando' || p.estado === 'en_preparacion')
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const preparando = pedidos.filter(p => p.estado === 'preparando' || p.estado === 'en_preparacion').length;
    const listos = pedidos.filter(p => p.estado === 'listo').length;
    const entregados = pedidos.filter(p => p.estado === 'entregado').length;

    const tiempos = pedidos
      .filter(p => p.tiempo_real_min && Number(p.tiempo_real_min) > 0)
      .map(p => Number(p.tiempo_real_min));
    const tiempoPromedioMin = tiempos.length > 0
      ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1))
      : 0;

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
      const items = p.productos || p.detalles_pedido || [];
      items.forEach((item) => {
        const name = item.nombre || item.productos?.nombre || 'Producto';
        const qty = Number(item.cantidad) || 1;
        productCountMap[name] = (productCountMap[name] || 0) + qty;
      });
    });

    return Object.entries(productCountMap)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  },
};

export const pedidos = pedidosService;
export default pedidosService;
