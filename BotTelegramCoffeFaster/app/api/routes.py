from datetime import datetime, timezone
from fastapi import APIRouter, Request, status
from app.domain.models import AlertaStockPayload, AlertaResponse, ProductoData
from app.services.alert_service import alert_service
from app.infrastructure.database import db_repo
from app.infrastructure.subscriber_repo import subscriber_repo

router = APIRouter()

@router.get("/")
async def root():
    return {
        "sistema": "CoffeeFaster - Stock Alert Bot",
        "arquitectura": "Clean Architecture",
        "version": "2.0.0",
        "estado": "operativo",
        "webhook_url": "/webhook/stock-alerta",
        "documentacion": "/docs"
    }

@router.get("/health")
async def health_check(request: Request):
    """Diagnóstico del estado del servidor, Telegram Bot y PostgreSQL."""
    db_ok = db_repo.verificar_conexion()
    telegram_app = getattr(request.app.state, "telegram_app", None)
    tg_ok = telegram_app is not None and telegram_app.bot is not None
    subs_count = len(subscriber_repo.get_all())

    return {
        "status": "healthy" if (db_ok and tg_ok) else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "servicios": {
            "webhook_server": "running",
            "telegram_bot": "connected" if tg_ok else "disabled_or_failed",
            "database_postgresql": "connected" if db_ok else "disconnected"
        },
        "suscriptores_telegram": subs_count
    }

@router.post(
    "/webhook/stock-alerta",
    response_model=AlertaResponse,
    status_code=status.HTTP_200_OK
)
async def recibir_alerta_stock(payload: AlertaStockPayload, request: Request):
    """
    Endpoint invocado por pg_net desde el trigger tr_alerta_stock_bajo de Supabase.
    """
    telegram_app = getattr(request.app.state, "telegram_app", None)
    bot = telegram_app.bot if telegram_app else None
    return await alert_service.procesar_alerta(payload=payload, bot=bot)

@router.post("/test-alerta", response_model=AlertaResponse, status_code=status.HTTP_200_OK)
async def simular_alerta_prueba(request: Request):
    """Endpoint para probar el flujo sin requerir disparar PostgreSQL."""
    payload = AlertaStockPayload(
        evento="ALERTA_STOCK_BAJO",
        producto=ProductoData(
            id=1,
            nombre="Café Espresso Doble (Prueba)",
            stock_actual=4,
            stock_anterior=15,
            stock_minimo_configurado=5,
            cafeteria_id=1
        ),
        umbral_disparo=10,
        timestamp=datetime.now(timezone.utc)
    )
    telegram_app = getattr(request.app.state, "telegram_app", None)
    bot = telegram_app.bot if telegram_app else None
    return await alert_service.procesar_alerta(payload=payload, bot=bot)
