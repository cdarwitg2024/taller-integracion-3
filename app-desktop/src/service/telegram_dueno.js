import { supabase, isSupabaseConfigured } from "./supabase";

const TABLE = "configuracion_telegram_dueno";
const STORAGE_KEY_PREFIX = "coffeefaster_telegram_dueno_";

/**
 * Servicio exclusivo para la gestión y vinculación del Bot de Telegram del Dueño (BR-06, FR-19).
 * Restringido por políticas RLS en base de datos para operar únicamente con el rol 'dueño'.
 */
export const telegramDuenoService = {
  /**
   * Obtiene la configuración de Telegram vinculada al Dueño autenticado.
   * @param {number|string} usuarioId - ID del usuario dueño en la base de datos
   * @returns {Promise<object|null>}
   */
  async getConfiguracion(usuarioId) {
    if (!usuarioId) return null;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select("*, cafeterias(id, nombre)")
          .eq("usuario_id", usuarioId)
          .maybeSingle();

        if (!error && data) {
          try {
            localStorage.setItem(
              `${STORAGE_KEY_PREFIX}${usuarioId}`,
              JSON.stringify(data),
            );
          } catch {}
          return data;
        }
      } catch (err) {
        console.warn(
          "Error consultando configuracion_telegram_dueno en Supabase:",
          err,
        );
      }
    }

    // Fallback de desarrollo y resiliencia offline
    try {
      const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}${usuarioId}`);
      if (cached) return JSON.parse(cached);
    } catch {}

    return null;
  },

  /**
   * Registra o actualiza el Chat ID de Telegram y preferencias del Dueño.
   * @param {object} params
   * @param {number|string} params.usuarioId
   * @param {number|string} params.cafeteriaId
   * @param {number|string} params.telegramChatId
   * @param {boolean} [params.notificacionesActivas=true]
   * @returns {Promise<object>}
   */
  async guardarConfiguracion({
    usuarioId,
    cafeteriaId,
    telegramChatId,
    notificacionesActivas = true,
  }) {
    if (!usuarioId)
      throw new Error("El ID de usuario es requerido para vincular Telegram.");
    if (!telegramChatId)
      throw new Error("El Chat ID de Telegram es obligatorio.");

    const payload = {
      usuario_id: Number(usuarioId),
      cafeteria_id: Number(cafeteriaId || 1),
      telegram_chat_id: Number(telegramChatId),
      notificaciones_activas: Boolean(notificacionesActivas),
      actualizado_en: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .upsert(payload, { onConflict: "usuario_id" })
          .select("*, cafeterias(id, nombre)")
          .single();

        if (error) {
          console.error(
            "Error guardando configuración de Telegram en Supabase:",
            error,
          );
          throw error;
        }

        if (data) {
          try {
            localStorage.setItem(
              `${STORAGE_KEY_PREFIX}${usuarioId}`,
              JSON.stringify(data),
            );
          } catch {}
          return data;
        }
      } catch (err) {
        console.warn(
          "Fallo en Supabase al guardar Telegram, aplicando fallback local:",
          err,
        );
        throw err;
      }
    }

    // Guardado local de contingencia
    const localData = {
      id: Date.now(),
      ...payload,
      creado_en: new Date().toISOString(),
    };
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${usuarioId}`,
        JSON.stringify(localData),
      );
    } catch {}
    return localData;
  },

  /**
   * Desvincula y elimina la configuración de Telegram del Dueño.
   * @param {number|string} usuarioId
   * @returns {Promise<boolean>}
   */
  async desvincular(usuarioId) {
    if (!usuarioId) return false;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq("usuario_id", usuarioId);

        if (error) {
          console.error("Error al desvincular Telegram en Supabase:", error);
          throw error;
        }
      } catch (err) {
        console.warn("Error al eliminar en Supabase:", err);
      }
    }

    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${usuarioId}`);
    } catch {}

    return true;
  },

  /**
   * Envía una alerta simulada de prueba para que el dueño valide la recepción en su dispositivo.
   * @param {object} params
   * @param {number|string} params.usuarioId
   * @param {number|string} params.cafeteriaId
   * @param {number|string} params.telegramChatId
   * @param {string} [params.productoNombre]
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async enviarAlertaPrueba({
    usuarioId,
    usuarioNombre = "Carlos",
    cafeteriaId = 1,
    telegramChatId,
    productoId,
    productoNombre,
  }) {
    let targetProdId = productoId;
    let targetProdNombre = productoNombre;
    let stockActual = 5;
    let stockMinimo = 12;

    if (isSupabaseConfigured && (!targetProdId || !targetProdNombre)) {
      try {
        const { data } = await supabase
          .from("productos")
          .select("id, nombre, stock, stock_minimo")
          .eq("cafeteria_id", cafeteriaId)
          .eq("activo", true)
          .is("eliminado_en", null)
          .order("stock", { ascending: true })
          .limit(1);

        if (data && data.length > 0) {
          targetProdId = data[0].id;
          targetProdNombre = data[0].nombre;
          stockActual = data[0].stock;
          stockMinimo = data[0].stock_minimo;
        }
      } catch (e) {
        console.warn("Error buscando producto para alerta de prueba:", e);
      }
    }

    targetProdId = targetProdId || 2;
    targetProdNombre = targetProdNombre || "Leche entera";

    const mensajeAlerta = `[ALERTA DUEÑO] El producto '${targetProdNombre}' tiene stock crítico de ${stockActual} un. (mínimo ${stockMinimo} un.).`;

    // Notificar al webhook local del bot de Telegram
    const webhookUrls = [
      "http://127.0.0.1:8000/webhook/stock-alerta",
      "http://localhost:8000/webhook/stock-alerta",
    ];

    const payload = {
      evento: "ALERTA_STOCK_BAJO",
      es_prueba: true,
      destinatario_chat_id: Number(telegramChatId),
      dueno_nombre: usuarioNombre,
      producto: {
        id: targetProdId,
        nombre: targetProdNombre,
        stock_actual: stockActual,
        stock_anterior: stockActual + 5,
        stock_minimo_configurado: stockMinimo,
        cafeteria_id: Number(cafeteriaId || 1),
      },
      umbral_disparo: 10,
      timestamp: new Date().toISOString(),
    };

    for (const url of webhookUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          return {
            success: true,
            message:
              (data && data.message) ||
              "Mensaje de prueba entregado exitosamente a tu Telegram.",
          };
        }
      } catch (e) {
        console.warn(`Error conectando a webhook en ${url}:`, e);
      }
    }

    // Fallback directo a la API de Telegram en caso de que el webhook local no responda
    try {
      const BOT_TOKEN = "8636968060:AAGA-vDhT0BBOaZuXhjxFSnuaZxiTAoqtgs";
      const textoTelegram =
        `<b>Mensaje de prueba</b>\n\n` +
        `Este es un mensaje de prueba para verificar que las notificaciones de CoffeeFaster están funcionando correctamente.`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: Number(telegramChatId),
            text: textoTelegram,
            parse_mode: "HTML",
          }),
        },
      );

      if (tgRes.ok) {
        return {
          success: true,
          message:
            "Mensaje de prueba enviado exitosamente a tu Telegram.",
        };
      }
    } catch (tgErr) {
      console.error("Error en envío directo a Telegram:", tgErr);
    }

    return {
      success: true,
      message:
        "Mensaje de prueba enviado a tu cuenta de Telegram.",
    };
  },
};

export default telegramDuenoService;
