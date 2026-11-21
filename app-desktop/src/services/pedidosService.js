import { supabase, isSupabaseConfigured } from './supabaseClient';
import { backendApi } from './backendApi';
import { parsearFecha, formatearHora, formatearHoraBucket } from '../utils/dateUtils';

// Claves que el QR / el backend pueden usar para identificar un pedido. El QR y
// el token de contingencia son credenciales distintas del MISMO pedido, asi que
// todas son candidatas validas para el mismo fin.
const CLAVES_CREDENCIAL = ['qr_token', 'token', 'codigo_retiro_diario', 'codigo_pedido', 'pedido_id', 'id'];

// ─── Criterio comun de ventas para indicadores administrativos (S2-T11) ───
// Periodo operativo compartido por los indicadores que representan ventas.
// Solo el gráfico por hora restringe la consulta a hoy.

// Estados que se consideran como venta para los indicadores administrativos.
// Los cancelados quedan fuera (tratamiento consistente con el criterio de venta).
const ESTADOS_VENTAS = ['entregado', 'listo', 'preparando', 'en_preparacion'];

/**
 * Indica si un pedido forma parte del criterio de ventas: no esta cancelado y
 * tiene un estado de venta. Punto unico de verdad para tarjetas y graficos.
 */
function esPedidoDeVentas(pedido) {
  const estado = String(pedido?.estado || '').toLowerCase();
  if (estado === 'cancelado' || ['rechazado', 'reembolsado'].includes(pedido?.pago_estado)) return false;
  if (estado === 'pendiente' || estado === 'pagado') return pedido?.pago_estado === 'pagado';
  return ESTADOS_VENTAS.includes(estado);
}

/**
 * Pedidos del periodo indicado (por defecto: jornada de hoy, hora local del cliente).
 */
function obtenerPedidosDelDia(pedidos, ref = new Date()) {
  const hoyStr = ref.toDateString();
  return (pedidos || []).filter((p) => {
    const f = parsearFecha(p.creado_en);
    return Boolean(f && f.toDateString() === hoyStr);
  });
}

/**
 * Suma las ventas (totales) de los pedidos que componen el criterio de ventas.
 */
function obtenerVentasDelDia(pedidosDelDia) {
  return (pedidosDelDia || [])
    .filter((p) => esPedidoDeVentas(p))
    .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
}

/**
 * Devuelve los pedidos validos de ventas del periodo indicado.
 */
function obtenerPedidosDeVentasDelDia(pedidosDelDia) {
  return (pedidosDelDia || []).filter((p) => esPedidoDeVentas(p));
}

/**
 * Devuelve TODAS las credenciales que se pueden extraer de una entrada arbitraria
 * (texto plano, JSON del QR, URL) en orden de prioridad, sin duplicados.
 *
 * Antes se elegia una sola y se descartaba el resto: si el QR traia el JSON con
 * `qr_token` y `codigo_retiro_diario`, solo se conservaba una de las dos. Con la
 * lista completa, si una credencial no resuelve el pedido se prueba la siguiente,
 * que es justamente el respaldo QR <-> token de contingencia.
 */
export function extraerCredenciales(texto) {
  const original = String(texto || '').trim().replace(/^["']+|["']+$/g, '');
  const candidatas = [];

  const agregar = (valor) => {
    if (valor === null || valor === undefined) return;
    const s = String(valor).trim();
    if (s && !candidatas.includes(s)) candidatas.push(s);
  };

  // El QR que genera el backend no es texto plano: es un JSON con la credencial
  // dentro. Sin sacarla de ahi la busqueda comparaba el JSON entero contra
  // `qr_token` y nunca encontraba el pedido.
  let qrInterpretado = false;
  if (original.startsWith('{')) {
    try {
      const payload = JSON.parse(original);
      CLAVES_CREDENCIAL.forEach((clave) => agregar(payload[clave]));
      qrInterpretado = true;
    } catch (e) {
      // JSON malformado: se sigue con el texto tal cual.
    }
  }

  // URL de retiro: la credencial es el ultimo segmento.
  if (/^https?:\/\//i.test(original)) {
    const segmento = original.split('/').filter(Boolean).pop();
    if (segmento) {
      agregar(segmento);
      qrInterpretado = true;
    }
  }

  // Si el QR ya se desarmo, el JSON o URL cruda no es una credencial: agregarlo solo
  // genera una consulta garantizadamente vacia.
  if (!qrInterpretado) agregar(original);

  return candidatas;
}

export function normalizarTokenQR(texto) {
  return extraerCredenciales(texto)[0] || '';
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
      : (Array.isArray(fila.productos)
        ? fila.productos
        : (Array.isArray(fila.items)
          ? fila.items
          : (Array.isArray(fila.detalles) ? fila.detalles : []))));

  const productos = rawDetalles.map((d) => {
    const p = d.productos || d.PRODUCTOS || {};
    const nombre = (Array.isArray(p) ? p[0]?.nombre : p?.nombre) || d.nombre || d.producto_nombre || 'Producto';
    const precio = Number(d.precio_unitario ?? d.precio ?? p?.precio ?? 0);
    const cantidad = Number(d.cantidad) || 1;
    return {
      id: d.id || d.producto_id || p?.id,
      producto_id: d.producto_id || d.id || p?.id,
      nombre,
      cantidad,
      detalle: d.nota || d.modificaciones || d.detalle || 'Sin modificaciones',
      precio,
    };
  });

  const userObj = fila.usuarios || fila.USUARIOS;
  const clienteNombre =
    fila.cliente ||
    (userObj ? `${userObj.nombre || ''} ${userObj.apellido || ''}`.trim() : 'Cliente General');

  const cafeObj = fila.cafeterias || fila.CAFETERIAS || {};
  const ubicacionNombre = fila.ubicacion || (cafeObj?.nombre ? cafeObj.nombre : 'Campus Central');

  // La identidad del pedido es su `id` de base de datos, nunca el token: el
  // token de contingencia es una credencial y no debe viajar en la tarjeta.
  const idStr = String(fila.id);

  // La hora de retiro puede venir vacia: `formatearHora` devolvería "--:--",
  // que no es un dato real y se colaba hasta la tarjeta. Se deja en null para
  // que la pantalla use la franja real del pedido o marque el estimado.
  const horaRetiroNormalizada = (() => {
    const hora = formatearHora(fila.hora_retiro);
    return hora === '--:--' ? null : hora;
  })();

  // Franja de retiro elegida por el estudiante: se toma SIEMPRE del pedido real
  // (columna franja_retiro) y se normaliza aqui, en el unico punto por el que
  // pasan tanto la carga inicial como las actualizaciones en tiempo real.
  const franjaRetiro = typeof fila.franja_retiro === 'string' ? fila.franja_retiro.trim() : '';

  return {
    ...fila,
    id: idStr,
    rawId: fila.id,
    codigo_pedido: fila.codigo_pedido || `#${fila.id}`,
    codigo_retiro_diario: fila.codigo_retiro_diario || null,
    qr_token: fila.qr_token || null,
    cliente: clienteNombre,
    ubicacion: ubicacionNombre,
    cafeteria_nombre: cafeObj?.nombre || 'Cafetería',
    cafeterias: cafeObj,
    hora: fila.hora || (fila.creado_en ? formatearHora(fila.creado_en) : undefined),
    hora_retiro: horaRetiroNormalizada,
    franja_retiro: franjaRetiro || null,
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
  // Ojo: `normalizarPedido` deja `hora_retiro` como texto "HH:mm", así que
  // hay que soportar los dos formatos que llegan desde la base.
  const creado = parsearFecha(pedido.creado_en);

  // S2-T7: Prioridad estricta según requerimiento
  // 1) franja_retiro: utilizar la hora de inicio de la franja
  if (pedido?.franja_retiro) {
    const franja = String(pedido.franja_retiro).trim();
    if (franja) {
      // Extraer inicio de la franja: puede venir como "12:30-12:45", "12:30 - 12:45"
      const inicio = franja.split(/[-–—]/)[0].trim();
      let minutos = aMinutosDelDia(inicio);
      if (minutos === null) {
        // Fallback: intentar parsear la franja completa por si viene en otro formato
        minutos = aMinutosDelDia(franja);
      }
      if (minutos !== null) {
        if (creado) {
          // "HH:mm" sobre el día en que se creó el pedido.
          const base = new Date(creado);
          base.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
          return base.getTime();
        }
        // Sin fecha de creación: se asume hoy.
        const hoy = new Date();
        hoy.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
        return hoy.getTime();
      }
    }
  }

  // 2) hora_retiro: utilizarla cuando no exista una franja válida
  const retiroTs = parsearFecha(pedido.hora_retiro);
  if (retiroTs) return retiroTs.getTime();

  const minutos = aMinutosDelDia(pedido.hora_retiro);
  if (minutos !== null) {
    if (creado) {
      // "HH:mm" sobre el dia en que se creo el pedido.
      const base = new Date(creado);
      base.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
      return base.getTime();
    }
    // Sin fecha de creacion: se asume hoy.
    const hoy = new Date();
    hoy.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    return hoy.getTime();
  }

  // 3) creado_en + 15 minutos: utilizarlo únicamente como fallback cuando no exista información de retiro válida
  if (creado) return creado.getTime() + 15 * 60000; // estimado por defecto
  return null;
}

function comparadorPrioridad(a, b) {
  // Ordenar por el instante real de retiro (franja/hora/estimado).
  // Los pedidos que deben retirarse antes aparecen primero.
  // Ante empate se mantiene el criterio por hora de creación.
  const tA = aInstanteRetiro(a);
  const tB = aInstanteRetiro(b);
  if (tA !== null && tB !== null && tA !== tB) return tA - tB;

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
    // El alcance de cafetería debe provenir exclusivamente del perfil/sesión del empleado (currentUser.cafeteria_id).
    // No se permite fallback silencioso a ninguna cafetería fija.
    if (cafeteriaId === null || cafeteriaId === undefined || cafeteriaId === '') {
      throw new Error('No se pudo determinar la cafetería autorizada del empleado. Sin asociación válida.');
    }
    if (typeof cafeteriaId !== 'number' && typeof cafeteriaId !== 'string') {
      throw new Error('No se pudo determinar la cafetería autorizada del empleado. Sin asociación válida.');
    }
    const cid = Number(cafeteriaId);
    if (!Number.isSafeInteger(cid) || cid <= 0) {
      throw new Error('No se pudo determinar la cafetería autorizada del empleado. Sin asociación válida.');
    }
    let query = supabase
      .from('pedidos')
      .select('*, usuarios(nombre, apellido), cafeterias(*), detalles_pedido(*, productos(*))')
      .eq('cafeteria_id', cid);

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
      .select('*, usuarios(nombre, apellido), cafeterias(*), detalles_pedido(*, productos(*))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener pedido por ID desde Supabase:', error);
      throw error;
    }
    return data ? normalizarPedido(data) : null;
  },

  async updateEstado(id, nuevoEstado) {
    // La entrega NO se escribe desde el cliente. La unica operacion valida es
    // POST /api/pedidos/validar-qr en ms-pedidos, que ejecuta la transicion
    // atomica y consume la credencial. Este guard impide que un llamador
    // reutilice el Kanban o el fallback para marcar un pedido como entregado.
    if (nuevoEstado === 'entregado') {
      throw new Error('La entrega del pedido solo se registra validando el QR o token en el servicio de pedidos.');
    }

    // 0. Regla de flujo: no se puede saltar estados
    //    (pendiente -> en_preparacion -> listo -> entregado).
    const actual = await this.getById(id);
    if (actual && !esTransicionValida(actual.estado, nuevoEstado)) {
      console.warn(`Transicion invalida de estado: ${actual.estado} -> ${nuevoEstado} (pedido ${id})`);
      return actual;
    }

    // 1. Vía MS Comercio (PATCH /pedidos/:id/estado) — backend debe ser autoridad
    try {
      await backendApi.cambiarEstadoPedido(id, nuevoEstado);
      const updated = await this.getById(id);
      if (updated) return updated;
      throw new Error('No se pudo obtener el pedido actualizado tras el cambio de estado.');
    } catch (err) {
      // Cancelar exige la RPC transaccional: nunca degradar a UPDATE de estado.
      if (nuevoEstado === 'cancelado') throw err;
      const status = err?.status;
      const code = err?.code;
      // Errores de autorización/prohibidos/conflictos: NO hacer fallback alternativo
      if (status === 401 || status === 403 || status === 409 || code === 'UNAUTHORIZED') {
        throw err;
      }
      // Errores de red/otros: NO asumir autorización para escribir directamente.
      // Solo intentar fallback si es claramente "no disponible" pero NO para rechazos del backend.
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('no autorizado') || msg.includes('forbidden') || msg.includes('conflict')) {
        throw err;
      }
      console.warn('MS Comercio no disponible o error no autorizado, intentando Supabase directo:', err.message);
    }

    // 2. Fallback: UPDATE directo en Supabase (solo si no fue un rechazo del backend)
    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado en el cliente');
    }

    const updates = { estado: nuevoEstado };
    const now = new Date().toISOString();
    if (nuevoEstado === 'en_preparacion' || nuevoEstado === 'preparando') updates.inicio_preparacion_en = now;
    if (nuevoEstado === 'listo') updates.listo_en = now;
    if (nuevoEstado === 'cancelado') updates.cancelado_en = now;

    const { data, error } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .select('*, usuarios(nombre, apellido), cafeterias(*), detalles_pedido(*, productos(*))')
      .single();

    if (error) {
      console.error('Error al actualizar estado del pedido en Supabase:', error);
      throw error;
    }
    return normalizarPedido(data);
  },

  async getEstadisticas(pedidos = null) {
    const lista = pedidos ?? (await this.getAll());

    // Mismo alcance de pedidos que el KDS, sin descartar fechas anteriores.
    const pedidosDelAlcance = lista;
    const totalVentas = obtenerVentasDelDia(pedidosDelAlcance);

    const pendientes = pedidosDelAlcance.filter((p) => p.estado === 'pendiente').length;
    const preparando = pedidosDelAlcance.filter((p) => p.estado === 'preparando' || p.estado === 'en_preparacion').length;
    const listos = pedidosDelAlcance.filter((p) => p.estado === 'listo').length;
    const entregados = pedidosDelAlcance.filter((p) => p.estado === 'entregado').length;

    const tiempos = pedidosDelAlcance
      .filter((p) => p.tiempo_real_min && Number(p.tiempo_real_min) > 0)
      .map((p) => Number(p.tiempo_real_min));
    const tiempoPromedioMin =
      tiempos.length > 0
        ? Number((tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1))
        : 0;

    return {
      totalVentas,
      totalPedidos: pedidosDelAlcance.length,
      pendientes,
      preparando,
      listos,
      entregados,
      tiempoPromedioMin,
    };
  },

  async getVentasPorHora(pedidos = null) {
    const lista = pedidos ?? (await this.getAll());
    const pedidosDelDia = obtenerPedidosDelDia(lista);

    // SOLO usamos pedidos de hoy. Si no hay pedidos hoy, no devolvemos datos
    // históricos: el gráfico debe mostrar ceros/cero ventas para hoy.
    const pedidosParaGrafico = obtenerPedidosDeVentasDelDia(pedidosDelDia);

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

    // Acumular ventas y cantidad de pedidos por tramo horario (criterio comun S2-T11)
    pedidosParaGrafico.forEach((p) => {
      const hourStr = formatearHoraBucket(p.creado_en);
      if (hourStr && hourlyMap[hourStr]) {
        hourlyMap[hourStr].ventas += Number(p.total || 0);
        hourlyMap[hourStr].pedidos += 1;
      }
    });

    return Object.values(hourlyMap).sort((a, b) => a.hora.localeCompare(b.hora));
  },

  async getTopProductos(pedidos = null) {
    const lista = pedidos ?? (await this.getAll());
    const productCountMap = {};

    const pedidosDeVentas = lista.filter(esPedidoDeVentas);

    pedidosDeVentas.forEach((p) => {
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
