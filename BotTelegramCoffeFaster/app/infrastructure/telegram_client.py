import logging
from typing import Dict, Any, Optional
from datetime import datetime
from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import TelegramError, Forbidden, BadRequest
from app.infrastructure.subscriber_repo import subscriber_repo
from app.infrastructure.database import db_repo
from app.domain.models import DeliveryResult

logger = logging.getLogger(__name__)

class TelegramClient:
    """Cliente de infraestructura para despacho de notificaciones formateadas por Telegram."""

    @staticmethod
    def formatear_alerta_encargado(payload: Dict[str, Any]) -> str:
        """Formatea el mensaje de alerta de stock simplificado sin emojis."""
        prod = payload.get("producto", {})
        ts_str = payload.get("timestamp", "")
        
        try:
            if isinstance(ts_str, str):
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                fecha_formateada = dt.strftime("%d/%m/%Y %H:%M:%S")
            elif isinstance(ts_str, datetime):
                fecha_formateada = ts_str.strftime("%d/%m/%Y %H:%M:%S")
            else:
                fecha_formateada = str(ts_str)
        except Exception:
            fecha_formateada = str(ts_str)

        nombre = prod.get("nombre", "Desconocido")
        stock_actual = prod.get("stock_actual", 0)
        stock_min = prod.get("stock_minimo_configurado", "N/A")

        es_prueba = (payload.get("evento") in ("PRUEBA", "TEST")) and not prod.get("nombre")
        if es_prueba:
            return (
                "<b>Mensaje de prueba</b>\n\n"
                "Este es un mensaje de prueba para verificar que las notificaciones de CoffeeFaster están funcionando correctamente."
            )

        if stock_actual <= 0:
            icono = "🔴"
            titulo = "Alerta: Sin stock"
            mensaje_sin_stock = "\n<b>Mensaje:</b> Sin stock"
        else:
            icono = "🟡"
            titulo = "Alerta: Stock bajo"
            mensaje_sin_stock = ""

        mensaje = (
            f"{icono} <b>{titulo}</b>\n\n"
            f"<b>Producto:</b> {nombre}\n"
            f"<b>Cantidad disponible:</b> {stock_actual}\n"
            f"<b>Mínimo que deberían existir:</b> {stock_min}\n"
            f"<b>Fecha de registro:</b> {fecha_formateada}"
            f"{mensaje_sin_stock}"
        )
        return mensaje

    @classmethod
    async def enviar_alerta(cls, bot: Optional[Bot], payload: Dict[str, Any]) -> DeliveryResult:
        """Envía la alerta exclusivamente a los Dueños vinculados y autorizados en base de datos."""
        if not bot:
            logger.warning("Instancia de bot de Telegram no disponible para enviar alerta.")
            return DeliveryResult(detalles="Bot no inicializado")

        destinatarios = []
        destinatario_chat_id = payload.get("destinatario_chat_id")

        if destinatario_chat_id:
            # Validar que siga activo y autorizado en base de datos
            dueno = db_repo.verificar_dueno_autorizado(destinatario_chat_id)
            if dueno:
                destinatarios.append(int(destinatario_chat_id))
            else:
                logger.warning(
                    f"Destinatario especificado {destinatario_chat_id} ya no está vinculado como dueño activo. Bloqueando envío."
                )
                return DeliveryResult(total_destinatarios=0, exitosos=0, fallidos=0, detalles="Destinatario desvinculado o no autorizado")
        else:
            # Si no vino explícito, buscar el dueño activo vinculado a la cafetería del producto
            prod = payload.get("producto", {})
            cafeteria_id = prod.get("cafeteria_id")
            destinatarios = db_repo.obtener_destinatarios_activos(cafeteria_id=cafeteria_id)
            if not destinatarios:
                logger.warning(f"No hay Dueño vinculado con notificaciones activas para cafetería #{cafeteria_id}.")
                return DeliveryResult(total_destinatarios=0, exitosos=0, fallidos=0, detalles="Sin dueño vinculado para esta cafetería")

        mensaje_html = cls.formatear_alerta_encargado(payload)
        exitosos = 0
        fallidos = 0

        for chat_id in destinatarios:
            try:
                await bot.send_message(
                    chat_id=chat_id,
                    text=mensaje_html,
                    parse_mode=ParseMode.HTML
                )
                exitosos += 1
                logger.info(f"Alerta operativa enviada con éxito al Dueño (Chat ID {chat_id})")
            except Forbidden:
                logger.warning(f"Bot bloqueado por chat {chat_id}. Desactivando en DB...")
                db_repo.actualizar_estado_notificaciones(chat_id, activas=False)
                fallidos += 1
            except BadRequest as e:
                logger.error(f"Error en envío a chat {chat_id}: {e}")
                fallidos += 1
            except TelegramError as e:
                logger.error(f"Error de Telegram con chat {chat_id}: {e}")
                fallidos += 1
            except Exception as e:
                logger.error(f"Error inesperado con chat {chat_id}: {e}")
                fallidos += 1

        return DeliveryResult(
            total_destinatarios=len(destinatarios),
            exitosos=exitosos,
            fallidos=fallidos
        )

telegram_client = TelegramClient()

