import { supabase, isSupabaseConfigured } from './supabase.js';
import { telegramDuenoService } from './telegram_dueno.js';
import { alertasStock } from './alertas_stock.js';

// URL base del servicio del Bot (FastAPI / Webhook)
const DEFAULT_BOT_URL = 'http://127.0.0.1:8000';

function getBotBaseUrl() {
  const envUrl = import.meta.env?.VITE_BOT_API_URL || import.meta.env?.VITE_TELEGRAM_WEBHOOK_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // Fallback
    }
  }
  return DEFAULT_BOT_URL;
}

export const botService = {
  getBaseUrl() {
    return getBotBaseUrl();
  },

  /**
   * Comprueba la conectividad y estado operativo del servicio del Bot (FastAPI).
   * Lanza o retorna error de conexión si el servicio no está en ejecución.
   * @returns {Promise<{ok: boolean, status?: string, data?: object, error?: string, url: string}>}
   */
  async checkHealth(timeoutMs = 4000) {
    const baseUrl = getBotBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          status: 'error',
          error: `El servicio del Bot respondió con código HTTP ${response.status} (${response.statusText}).`,
          url: baseUrl,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        status: data.status || 'healthy',
        data,
        url: baseUrl,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout
        ? `Tiempo de espera agotado al conectar con el servicio del Bot en ${baseUrl} (${timeoutMs / 1000}s).`
        : `No se pudo establecer conexión con el servicio del Bot en ${baseUrl}. Asegúrese de que el servidor (FastAPI / bot_server.py) esté iniciado.`;

      return {
        ok: false,
        status: 'disconnected',
        error: errorMessage,
        details: err.message,
        url: baseUrl,
      };
    }
  },

  /**
   * Envía una alerta de prueba al servicio del bot y valida la entrega.
   */
  async enviarAlertaPrueba({ usuarioId = 1, cafeteriaId = 1, telegramChatId }) {
    const baseUrl = getBotBaseUrl();

    // Validar primero si el servicio responde
    const health = await this.checkHealth(3000);
    if (!health.ok) {
      return {
        ok: false,
        error: `Error de conexión con el servicio del Bot: ${health.error}`,
        serviceOffline: true,
      };
    }

    try {
      const res = await telegramDuenoService.enviarAlertaPrueba({
        usuarioId,
        cafeteriaId,
        telegramChatId,
      });

      if (res.success) {
        return { ok: true, message: res.message || 'Alerta de prueba entregada exitosamente al Bot.' };
      } else {
        return { ok: false, error: res.error || 'El servicio no pudo procesar la alerta de prueba.' };
      }
    } catch (err) {
      return {
        ok: false,
        error: `Fallo al comunicarse con el servicio del Bot: ${err.message}`,
      };
    }
  },

  /**
   * Obtiene la información del dueño y su cafetería asignada.
   */
  async getContextoDueno(usuarioId = 1) {
    let duenoNombre = 'Carlos Dueño';
    let cafeteriaNombre = 'Cafetería Central';
    let cafeteriaId = 1;
    let telegramChatId = null;
    let notificacionesActivas = true;

    if (isSupabaseConfigured) {
      try {
        const { data: uData } = await supabase
          .from('usuarios')
          .select('id, nombre, apellido, roles(nombre)')
          .eq('id', usuarioId)
          .maybeSingle();

        if (uData) {
          duenoNombre = `${uData.nombre} ${uData.apellido || ''}`.trim();
        }

        const { data: cuData } = await supabase
          .from('cafeteria_usuarios')
          .select('cafeteria_id, cafeterias(id, nombre)')
          .eq('usuario_id', usuarioId)
          .maybeSingle();

        if (cuData) {
          cafeteriaId = cuData.cafeteria_id;
          if (cuData.cafeterias?.nombre) cafeteriaNombre = cuData.cafeterias.nombre;
        }

        const configTg = await telegramDuenoService.getConfiguracion(usuarioId);
        if (configTg) {
          telegramChatId = configTg.telegram_chat_id;
          notificacionesActivas = configTg.notificaciones_activas !== false;
        }
      } catch (err) {
        console.warn('Error resolviendo contexto de dueño:', err);
      }
    }

    return {
      usuarioId,
      duenoNombre,
      cafeteriaId,
      cafeteriaNombre,
      telegramChatId,
      notificacionesActivas,
    };
  },

  /**
   * Obtiene la lista de productos filtrada para la cafetería del dueño.
   */
  async getProductosCafeteria(cafeteriaId = 1) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('id, nombre, stock, stock_minimo, precio, activo, cafeteria_id, categorias(nombre)')
          .eq('cafeteria_id', cafeteriaId)
          .eq('activo', true)
          .is('eliminado_en', null)
          .order('nombre', { ascending: true });

        if (!error && data) {
          return data.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            stock: Number(p.stock ?? 0),
            stock_minimo: Number(p.stock_minimo ?? 10),
            precio: Number(p.precio ?? 0),
            categoria: p.categorias?.nombre || 'General',
          }));
        }
      } catch (err) {
        console.warn('Error obteniendo productos de cafetería:', err);
      }
    }

    // Fallback de desarrollo con datos reales coherentes
    return [
      { id: 1, nombre: 'Café Espresso Doble', stock: 4, stock_minimo: 10, precio: 2200, categoria: 'Cafetería' },
      { id: 2, nombre: 'Leche Entera 1L', stock: 8, stock_minimo: 12, precio: 1500, categoria: 'Insumos' },
      { id: 3, nombre: 'Muffin de Arándanos', stock: 0, stock_minimo: 8, precio: 1800, categoria: 'Pastelería' },
      { id: 4, nombre: 'Café Americano Grande', stock: 25, stock_minimo: 10, precio: 2500, categoria: 'Cafetería' },
      { id: 5, nombre: 'Medialuna Tradicional', stock: 15, stock_minimo: 10, precio: 1200, categoria: 'Pastelería' },
      { id: 6, nombre: 'Té Verde Matcha', stock: 0, stock_minimo: 5, precio: 2900, categoria: 'Bebidas' },
    ];
  },

  /**
   * Ejecuta una consulta básica y genera la respuesta estructurada y formateada del BOT.
   * Valida la conexión con el servicio del Bot y refleja posibles errores.
   * @param {string} comando - Ej: '/stock', '/stock_bajo', '/agotados', '/alertas', '/estado', '/cafeteria', '/test_alerta'
   * @param {object} contexto - Datos del usuario y cafetería
   * @returns {Promise<{ok: boolean, tipo: string, titulo: string, texto: string, datos?: any, isConnectionError?: boolean, serviceStatus?: object}>}
   */
  async procesarConsulta(comando, contexto = {}) {
    const rawCmd = String(comando || '').trim().toLowerCase();
    const dueno = await this.getContextoDueno(contexto.usuarioId || 1);
    const cafeteriaId = dueno.cafeteriaId;

    // Normalizar comando
    let accion = 'desconocido';
    if (rawCmd.includes('test') || rawCmd.includes('prueba')) {
      accion = 'test_alerta';
    } else if (rawCmd.includes('stock_bajo') || rawCmd.includes('bajo') || rawCmd.includes('crítico')) {
      accion = 'stock_bajo';
    } else if (rawCmd.includes('agotado') || rawCmd.includes('sin_stock') || rawCmd.includes('quiebre')) {
      accion = 'agotados';
    } else if (rawCmd.includes('alerta') || rawCmd.includes('historial')) {
      accion = 'alertas';
    } else if (rawCmd.includes('estado') || rawCmd.includes('status') || rawCmd.includes('health') || rawCmd.includes('servicio')) {
      accion = 'estado';
    } else if (rawCmd.includes('cafeteria') || rawCmd.includes('perfil') || rawCmd.includes('dueño') || rawCmd.includes('dueno')) {
      accion = 'cafeteria';
    } else if (rawCmd.includes('stock') || rawCmd.includes('inventario') || rawCmd.includes('existencias')) {
      accion = 'stock';
    } else if (rawCmd.includes('ayuda') || rawCmd.includes('help') || rawCmd.includes('menu') || rawCmd.includes('start')) {
      accion = 'ayuda';
    }

    // 1. Consulta: ESTADO DEL SERVICIO
    if (accion === 'estado') {
      const health = await this.checkHealth();
      if (!health.ok) {
        return {
          ok: false,
          tipo: 'error_conexion',
          isConnectionError: true,
          titulo: 'Error de Conexión con el Servicio del Bot',
          texto: `❌ <b>No se pudo conectar con el servicio del Bot</b>\n\n` +
            `• <b>URL del servicio:</b> <code>${health.url}</code>\n` +
            `• <b>Detalle del error:</b> ${health.error}\n\n` +
            `⚠️ <i>Verifique que el servidor del bot esté en ejecución ejecutando:</i>\n` +
            `<code>python bot_server.py</code> (dentro de BotTelegramCoffeFaster).`,
          serviceStatus: health,
        };
      }

      const servicios = health.data?.servicios || {};
      const tgStatus = servicios.telegram_bot === 'connected' ? '🟢 Conectado' : '🟡 Desactivado o en espera de token';
      const dbStatus = servicios.database_postgresql === 'connected' ? '🟢 Conectada' : '🔴 Desconectada';
      const subs = health.data?.suscriptores_telegram ?? 0;

      return {
        ok: true,
        tipo: 'estado',
        titulo: 'Diagnóstico Operativo del Bot',
        texto: `⚡ <b>Estado del Sistema CoffeeFaster Bot</b>\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `• <b>Servidor API/Webhook:</b> 🟢 Operativo (FastAPI)\n` +
          `• <b>Bot de Telegram:</b> ${tgStatus}\n` +
          `• <b>Base de Datos Supabase:</b> ${dbStatus}\n` +
          `• <b>Dueños/Dispositivos suscritos:</b> <b>${subs}</b>\n` +
          `• <b>URL Webhook:</b> <code>${health.url}/webhook/stock-alerta</code>\n` +
          `• <b>Sincronización:</b> ${new Date().toLocaleTimeString('es-CL')}`,
        serviceStatus: health.data,
      };
    }

    // 2. Consulta: PROBAR ALERTA DE STOCK (Contacto con servicio)
    if (accion === 'test_alerta') {
      const health = await this.checkHealth(2500);
      if (!health.ok) {
        return {
          ok: false,
          tipo: 'error_conexion',
          isConnectionError: true,
          titulo: 'Error de Conexión al Probar Alerta',
          texto: `❌ <b>Fallo al enviar alerta de prueba</b>\n\n` +
            `El servicio del Bot no respondió en <code>${health.url}</code>.\n` +
            `• <b>Causa:</b> ${health.error}\n\n` +
            `Asegúrate de que el proceso del bot esté activo en el puerto 8000.`,
          serviceStatus: health,
        };
      }

      const resPrueba = await this.enviarAlertaPrueba({
        usuarioId: dueno.usuarioId,
        cafeteriaId: dueno.cafeteriaId,
        telegramChatId: dueno.telegramChatId || 12345678,
      });

      if (!resPrueba.ok) {
        return {
          ok: false,
          tipo: 'error_servicio',
          isConnectionError: resPrueba.serviceOffline || false,
          titulo: 'Alerta de Prueba no Entregada',
          texto: `⚠️ <b>Respuesta del Servicio del Bot:</b>\n${resPrueba.error}`,
        };
      }

      return {
        ok: true,
        tipo: 'test_alerta',
        titulo: 'Alerta de Prueba Despachada',
        texto: `✅ <b>Prueba de Notificación Exitosa</b>\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `• <b>Servicio:</b> Webhook FastAPI activo en <code>${health.url}</code>\n` +
          `• <b>Destinatario:</b> ${dueno.duenoNombre} (Chat ID: ${dueno.telegramChatId || 'Simulado'})\n` +
          `• <b>Mensaje:</b> ${resPrueba.message || 'Alerta enviada correctamente.'}`,
      };
    }

    // 3. Consulta: CONSULTAR STOCK GENERAL
    if (accion === 'stock') {
      const prods = await this.getProductosCafeteria(cafeteriaId);
      const total = prods.length;
      const agotados = prods.filter((p) => p.stock <= 0);
      const bajos = prods.filter((p) => p.stock > 0 && p.stock <= Math.max(p.stock_minimo, 10));
      const optimos = prods.filter((p) => p.stock > Math.max(p.stock_minimo, 10));

      let detalleTexto = '';
      prods.forEach((p) => {
        if (p.stock <= 0) {
          detalleTexto += `• 🔴 <b>${p.nombre}</b>: <b>0 un.</b> (Mínimo: ${p.stock_minimo} un.) [AGOTADO]\n`;
        } else if (p.stock <= p.stock_minimo || p.stock <= 10) {
          detalleTexto += `• 🟡 <b>${p.nombre}</b>: <b>${p.stock} un.</b> (Mínimo: ${p.stock_minimo} un.) [BAJO]\n`;
        } else {
          detalleTexto += `• 🟢 <b>${p.nombre}</b>: <b>${p.stock} un.</b> (Mínimo: ${p.stock_minimo} un.)\n`;
        }
      });

      const texto = `📦 <b>Inventario General - ${dueno.cafeteriaNombre}</b>\n` +
        `<b>Dueño Responsable:</b> ${dueno.duenoNombre} (Cafetería ID #${dueno.cafeteriaId})\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Resumen de existencias:</b>\n` +
        `• Total productos monitoreados: <b>${total}</b>\n` +
        `• 🟢 En nivel óptimo: <b>${optimos.length}</b>\n` +
        `• 🟡 Con stock bajo: <b>${bajos.length}</b>\n` +
        `• 🔴 Agotados: <b>${agotados.length}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `<b>Detalle de insumos:</b>\n\n` +
        (detalleTexto || '<i>No se encontraron insumos activos.</i>');

      return {
        ok: true,
        tipo: 'stock',
        titulo: 'Inventario General',
        texto,
        datos: { total, optimos: optimos.length, bajos: bajos.length, agotados: agotados.length, productos: prods },
      };
    }

    // 4. Consulta: STOCK BAJO (≤ 10 un.)
    if (accion === 'stock_bajo') {
      const prods = await this.getProductosCafeteria(cafeteriaId);
      const bajos = prods.filter((p) => p.stock > 0 && p.stock <= Math.max(p.stock_minimo, 10));

      if (bajos.length === 0) {
        return {
          ok: true,
          tipo: 'stock_bajo',
          titulo: 'Stock Bajo: Todo en Orden',
          texto: `✅ <b>Sin Productos con Stock Bajo - ${dueno.cafeteriaNombre}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `Todos los productos de la cafetería cuentan con cantidades suficientes de stock en inventario (> 10 un.).`,
          datos: { cantidad: 0, productos: [] },
        };
      }

      let detalle = '';
      bajos.forEach((p) => {
        detalle += `🟡 <b>${p.nombre}</b>\n` +
          `   • Cantidad disponible: <b>${p.stock} unidades</b>\n` +
          `   • Umbral mínimo configurado: ${p.stock_minimo} un.\n` +
          `   • Estado: ⚠️ Crítico / Requiere reposición inmediata\n\n`;
      });

      const texto = `⚠️ <b>Productos con Stock Bajo - ${dueno.cafeteriaNombre}</b>\n` +
        `<b>Dueño Responsable:</b> ${dueno.duenoNombre}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Se identificaron <b>${bajos.length}</b> insumos que alcanzaron o están por debajo del nivel crítico de existencias (≤ 10 un.):\n\n` +
        detalle;

      return {
        ok: true,
        tipo: 'stock_bajo',
        titulo: 'Productos con Stock Bajo',
        texto,
        datos: { cantidad: bajos.length, productos: bajos },
      };
    }

    // 5. Consulta: PRODUCTOS AGOTADOS (0 un.)
    if (accion === 'agotados') {
      const prods = await this.getProductosCafeteria(cafeteriaId);
      const agotados = prods.filter((p) => p.stock <= 0);

      if (agotados.length === 0) {
        return {
          ok: true,
          tipo: 'agotados',
          titulo: 'Sin Quiebres de Stock',
          texto: `✅ <b>Sin Productos Agotados - ${dueno.cafeteriaNombre}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `No hay quiebres de stock registrados en este momento. Todos los insumos cuentan con unidades disponibles para la venta.`,
          datos: { cantidad: 0, productos: [] },
        };
      }

      let detalle = '';
      agotados.forEach((p) => {
        detalle += `🔴 <b>${p.nombre}</b>\n` +
          `   • Cantidad disponible: <b>0 unidades</b>\n` +
          `   • Umbral mínimo requerido: ${p.stock_minimo} un.\n` +
          `   • Acción sugerida: Reponer stock a la brevedad.\n\n`;
      });

      const texto = `🔴 <b>Productos Agotados (Sin Stock) - ${dueno.cafeteriaNombre}</b>\n` +
        `<b>Dueño Responsable:</b> ${dueno.duenoNombre}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Se identificaron <b>${agotados.length}</b> productos sin existencias en este momento:\n\n` +
        detalle;

      return {
        ok: true,
        tipo: 'agotados',
        titulo: 'Productos Agotados',
        texto,
        datos: { cantidad: agotados.length, productos: agotados },
      };
    }

    // 6. Consulta: HISTORIAL DE ALERTAS
    if (accion === 'alertas') {
      let listaAlertas = [];
      try {
        listaAlertas = await alertasStock.getByCafeteria(cafeteriaId);
      } catch (err) {
        console.warn('Error consultando alertas:', err);
      }

      if (!listaAlertas || listaAlertas.length === 0) {
        return {
          ok: true,
          tipo: 'alertas',
          titulo: 'Historial de Alertas Vacío',
          texto: `🔔 <b>Historial de Alertas de Stock - ${dueno.cafeteriaNombre}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `<i>No hay registros recientes de alertas de stock crítico disparadas para esta cafetería.</i>`,
          datos: { alertas: [] },
        };
      }

      const ultimas = listaAlertas.slice(0, 5);
      let detalle = '';
      ultimas.forEach((a, idx) => {
        const fecha = a.creado_en ? new Date(a.creado_en).toLocaleString('es-CL') : 'Reciente';
        const prod = a.productos?.nombre || `Producto #${a.producto_id}`;
        detalle += `${idx + 1}. ⚠️ <b>${prod}</b>: Stock ${a.stock_actual} (Mín: ${a.stock_minimo})\n` +
          `   • Mensaje: <i>${a.mensaje || 'Alerta de stock bajo'}</i>\n` +
          `   • Fecha: ${fecha}\n\n`;
      });

      const texto = `🔔 <b>Historial de Alertas de Stock - ${dueno.cafeteriaNombre}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Últimas <b>${ultimas.length}</b> alertas automáticas registradas:\n\n` +
        detalle;

      return {
        ok: true,
        tipo: 'alertas',
        titulo: 'Historial de Alertas',
        texto,
        datos: { alertas: ultimas },
      };
    }

    // 7. Consulta: MI CAFETERÍA
    if (accion === 'cafeteria') {
      const dbOk = isSupabaseConfigured;
      const estadoAlertas = dueno.notificacionesActivas ? '🟢 Activadas (≤ 10 un.)' : '🟡 Pausadas';
      const tgStatus = dueno.telegramChatId ? `🟢 Vinculado (Chat ID: <code>${dueno.telegramChatId}</code>)` : '🟡 Sin vincular';

      const texto = `👤 <b>Información de Cafetería y Dueño</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Cafetería:</b> ${dueno.cafeteriaNombre} (ID #${dueno.cafeteriaId})\n` +
        `• <b>Dueño Responsable:</b> ${dueno.duenoNombre}\n` +
        `• <b>Dispositivo Telegram:</b> ${tgStatus}\n` +
        `• <b>Alertas Automáticas:</b> ${estadoAlertas}\n` +
        `• <b>Conexión con Base de Datos:</b> ${dbOk ? '🟢 Conectada' : '🔴 Desconectada'}\n` +
        `• <b>Rol:</b> Dueño de Cafetería (Administrador)`;

      return {
        ok: true,
        tipo: 'cafeteria',
        titulo: 'Información de Cafetería',
        texto,
        datos: dueno,
      };
    }

    // 8. Consulta: AYUDA / MENÚ
    return {
      ok: true,
      tipo: 'ayuda',
      titulo: 'Comandos Disponibles del Bot',
      texto: `🤖 <b>Comandos y Consultas Básicas del Bot:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Puedes presionar los botones superiores o escribir cualquiera de los siguientes comandos:\n\n` +
        `• <b>/stock</b> o <b>/inventario</b>: Resumen y lista completa de existencias.\n` +
        `• <b>/stock_bajo</b> o <b>/bajo</b>: Productos que requieren reposición urgente (≤ 10 un.).\n` +
        `• <b>/agotados</b> o <b>/sin_stock</b>: Productos con stock en 0 unidades.\n` +
        `• <b>/alertas</b>: Registro histórico de alertas emitidas.\n` +
        `• <b>/estado</b>: Diagnóstico de conexión del bot, webhook y base de datos.\n` +
        `• <b>/cafeteria</b>: Datos de tu cafetería y estado de vinculación.\n` +
        `• <b>/test_alerta</b>: Enviar un evento de prueba al servicio del bot.\n` +
        `• <b>/ayuda</b>: Ver este listado de comandos.`,
    };
  },
};

export default botService;
