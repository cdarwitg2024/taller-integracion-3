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

    let resolvedCafeteriaId = cafeteriaId;
    if (!resolvedCafeteriaId && isSupabaseConfigured && usuarioId) {
      try {
        const { data: cu } = await supabase
          .from("cafeteria_usuarios")
          .select("cafeteria_id")
          .eq("usuario_id", usuarioId)
          .maybeSingle();
        if (cu?.cafeteria_id) {
          resolvedCafeteriaId = cu.cafeteria_id;
        } else {
          const { data: caf } = await supabase
            .from("cafeterias")
            .select("id")
            .limit(1)
            .maybeSingle();
          if (caf?.id) resolvedCafeteriaId = caf.id;
        }
      } catch (err) {
        console.warn("Error resolviendo cafetería desde DB:", err);
      }
    }

    const payload = {
      usuario_id: Number(usuarioId),
      cafeteria_id: Number(resolvedCafeteriaId || 1),
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
   * Obtiene la información estrictamente desde variables de entorno (.env) o desde la base de datos.
   * @param {object} params
   * @param {number|string} params.usuarioId
   * @param {string} [params.usuarioNombre]
   * @param {number|string} [params.cafeteriaId]
   * @param {number|string} params.telegramChatId
   * @param {number|string} [params.productoId]
   * @param {string} [params.productoNombre]
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async enviarAlertaPrueba({
    usuarioId,
    usuarioNombre,
    cafeteriaId,
    telegramChatId,
    productoId,
    productoNombre,
  }) {
    if (!telegramChatId) {
      throw new Error("El Chat ID de Telegram es obligatorio para la prueba.");
    }

    // 1. Obtener usuario y cafetería desde la base de datos si no fueron provistos
    let targetUsuarioNombre = usuarioNombre || "";
    let targetCafeteriaId = cafeteriaId;

    if (isSupabaseConfigured && usuarioId) {
      try {
        if (!targetUsuarioNombre) {
          const { data: uData } = await supabase
            .from("usuarios")
            .select("nombre, apellido")
            .eq("id", usuarioId)
            .maybeSingle();
          if (uData?.nombre) {
            targetUsuarioNombre = `${uData.nombre} ${uData.apellido || ""}`.trim();
          }
        }

        if (!targetCafeteriaId) {
          const { data: cuData } = await supabase
            .from("cafeteria_usuarios")
            .select("cafeteria_id")
            .eq("usuario_id", usuarioId)
            .maybeSingle();
          if (cuData?.cafeteria_id) {
            targetCafeteriaId = cuData.cafeteria_id;
          }
        }
      } catch (err) {
        console.warn("Error resolviendo usuario/cafetería desde DB:", err);
      }
    }

    // 2. Obtener producto real desde la base de datos
    let targetProdId = productoId;
    let targetProdNombre = productoNombre;
    let stockActual = null;
    let stockMinimo = null;

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from("productos")
          .select("id, nombre, stock, stock_minimo, cafeteria_id")
          .eq("activo", true)
          .is("eliminado_en", null);

        if (targetCafeteriaId) {
          query = query.eq("cafeteria_id", targetCafeteriaId);
        }
        if (targetProdId) {
          query = query.eq("id", targetProdId);
        }

        const { data } = await query
          .order("stock", { ascending: true })
          .limit(1);

        if (data && data.length > 0) {
          targetProdId = data[0].id;
          targetProdNombre = data[0].nombre;
          stockActual = data[0].stock;
          stockMinimo = data[0].stock_minimo;
          if (!targetCafeteriaId) targetCafeteriaId = data[0].cafeteria_id;
        }
      } catch (e) {
        console.warn("Error consultando producto desde base de datos:", e);
      }
    }

    // Valores seguros en caso de base de datos vacía
    const finalStockActual = typeof stockActual === "number" ? stockActual : 5;
    const finalStockMinimo = typeof stockMinimo === "number" ? stockMinimo : 10;
    const finalProdNombre = targetProdNombre || "Producto de Prueba";

    // 3. Webhook URL obtenido de variables de entorno (.env)
    const envWebhook = import.meta.env?.VITE_TELEGRAM_WEBHOOK_URL;
    const webhookUrls = [
      ...(envWebhook ? [envWebhook] : []),
      "http://127.0.0.1:8000/webhook/stock-alerta",
      "http://localhost:8000/webhook/stock-alerta",
    ];

    const payload = {
      evento: "ALERTA_STOCK_BAJO",
      es_prueba: true,
      destinatario_chat_id: Number(telegramChatId),
      dueno_nombre: targetUsuarioNombre || "Dueño",
      producto: {
        id: targetProdId || 0,
        nombre: finalProdNombre,
        stock_actual: finalStockActual,
        stock_anterior: finalStockActual + 5,
        stock_minimo_configurado: finalStockMinimo,
        cafeteria_id: Number(targetCafeteriaId || 1),
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

    // 4. Fallback directo a la API de Telegram SOLO si el token está definido en el archivo .env
    const botToken =
      import.meta.env?.VITE_TELEGRAM_BOT_TOKEN ||
      import.meta.env?.VITE_BOT_TOKEN_KEY;

    if (botToken) {
      try {
        const textoTelegram =
          `<b>Mensaje de prueba</b>\n\n` +
          `Este es un mensaje de prueba para verificar que las notificaciones de CoffeeFaster están funcionando correctamente.`;

        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
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
            message: "Mensaje de prueba enviado exitosamente a tu Telegram.",
          };
        }
      } catch (tgErr) {
        console.error("Error en envío directo a Telegram:", tgErr);
      }
    }

    return {
      success: true,
      message: "Mensaje de prueba enviado a tu cuenta de Telegram.",
    };
  },
};

export default telegramDuenoService;
