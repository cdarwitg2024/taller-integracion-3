import logging
from typing import Optional
from telegram import Bot
from app.domain.models import AlertaStockPayload, AlertaResponse
from app.infrastructure.database import db_repo
from app.infrastructure.telegram_client import telegram_client

logger = logging.getLogger(__name__)

class AlertService:
    """Caso de uso: Procesamiento y distribución de alertas de stock bajo."""

    @staticmethod
    async def procesar_alerta(payload: AlertaStockPayload, bot: Optional[Bot]) -> AlertaResponse:
        prod = payload.producto

        # 1. Impresión estructurada en consola (especificación del README)
        print(f"\n[ALERTA DE STOCK] -----------------------------")
        print(f"Cafetería ID : {prod.cafeteria_id}")
        print(f"Producto     : {prod.nombre} (ID: {prod.id})")
        print(f"Stock Actual : {prod.stock_actual} (Antes: {prod.stock_anterior})")
        print(f"Umbral       : {payload.umbral_disparo}")
        print(f"Fecha/Hora   : {payload.timestamp}")
        print(f"--------------------------------------------------\n")

        # 2. Persistir en base de datos solo si es una alerta real de stock (no prueba)
        alerta_id = None
        if not payload.es_prueba:
            if prod.stock_actual <= 0:
                mensaje_db = f"Producto '{prod.nombre}' sin stock (0 unidades disponibles)"
            else:
                mensaje_db = f"Stock de '{prod.nombre}' bajó a {prod.stock_actual} (umbral: {payload.umbral_disparo})"
            alerta_id = db_repo.guardar_alerta(
                cafeteria_id=prod.cafeteria_id,
                producto_id=prod.id,
                stock_actual=prod.stock_actual,
                stock_minimo=prod.stock_minimo_configurado,
                mensaje=mensaje_db
            )

        # 3. Notificar vía Telegram a los encargados
        payload_dict = payload.model_dump()
        delivery_result = await telegram_client.enviar_alerta(bot, payload_dict)

        return AlertaResponse(
            status="success",
            message=f"Alerta procesada para {prod.nombre}",
            alerta_db_id=alerta_id,
            telegram=delivery_result
        )

alert_service = AlertService()
