import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from telegram.ext import ApplicationBuilder, CommandHandler

from app.core.config import settings
from app.infrastructure.database import db_repo
from app.api.routes import router
from app.bot.handlers import (
    cmd_start,
    cmd_ayuda,
    cmd_estado,
    cmd_alertas,
    cmd_stock,
    cmd_suscribir,
    cmd_desuscribir,
    cmd_test_alerta,
    cmd_test_sin_stock,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("coffeefaster_bot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación: administra el ciclo de vida del bot de Telegram."""
    logger.info("Iniciando CoffeeFaster Bot (Clean Architecture)...")

    # 1. Comprobar base de datos
    db_ok = db_repo.verificar_conexion()
    if db_ok:
        logger.info("Conexión con PostgreSQL / Supabase verificada.")
    else:
        logger.warning("No se pudo conectar con PostgreSQL. Operando en modo resiliente.")

    # 2. Inicializar Bot de Telegram
    telegram_app = None
    if settings.BOT_TOKEN:
        try:
            logger.info("Configurando Bot de Telegram...")
            telegram_app = ApplicationBuilder().token(settings.BOT_TOKEN).build()

            # Registrar comandos de Telegram
            telegram_app.add_handler(CommandHandler("start", cmd_start))
            telegram_app.add_handler(CommandHandler("ayuda", cmd_ayuda))
            telegram_app.add_handler(CommandHandler("help", cmd_ayuda))
            telegram_app.add_handler(CommandHandler("estado", cmd_estado))
            telegram_app.add_handler(CommandHandler("status", cmd_estado))
            telegram_app.add_handler(CommandHandler("alertas", cmd_alertas))
            telegram_app.add_handler(CommandHandler("stock", cmd_stock))
            telegram_app.add_handler(CommandHandler("suscribir", cmd_suscribir))
            telegram_app.add_handler(CommandHandler("desuscribir", cmd_desuscribir))
            telegram_app.add_handler(CommandHandler("test_alerta", cmd_test_alerta))
            telegram_app.add_handler(CommandHandler("test_sin_stock", cmd_test_sin_stock))

            # Iniciar polling asíncrono
            await telegram_app.initialize()
            await telegram_app.start()
            await telegram_app.updater.start_polling(drop_pending_updates=False)

            bot_info = await telegram_app.bot.get_me()
            logger.info(f"Bot de Telegram @{bot_info.username} en escucha activa de comandos.")
        except Exception as e:
            logger.error(f"Error iniciando Telegram Bot: {e}")
            telegram_app = None
    else:
        logger.warning("BOT_TOKEN_KEY no configurado en .env.")

    # Almacenar instancia en el estado de FastAPI para acceso en rutas
    app.state.telegram_app = telegram_app
    logger.info(f"Webhook disponible en http://{settings.HOST}:{settings.PORT}/webhook/stock-alerta")

    yield

    # Detener bot al apagar el servidor
    if telegram_app:
        logger.info("Deteniendo Bot de Telegram...")
        try:
            await telegram_app.updater.stop()
            await telegram_app.stop()
            await telegram_app.shutdown()
            logger.info("Bot de Telegram cerrado correctamente.")
        except Exception as e:
            logger.error(f"Error al cerrar bot: {e}")

def create_app() -> FastAPI:
    application = FastAPI(
        title="CoffeeFaster - Stock Alert Bot",
        description="Servidor de Webhook y Bot de Telegram para Alertas de Stock Bajo (Clean Architecture)",
        version="2.0.0",
        lifespan=lifespan
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    return application

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
