import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Ruta raíz del proyecto
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    # Telegram Bot
    BOT_TOKEN: str = os.getenv("BOT_TOKEN_KEY", "").strip() or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    
    # Chat IDs por defecto desde variable de entorno
    _CHAT_IDS_RAW: str = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    DEFAULT_CHAT_IDS: List[int] = [
        int(cid.strip()) for cid in _CHAT_IDS_RAW.split(",") if cid.strip().lstrip("-").isdigit()
    ] if _CHAT_IDS_RAW else []

    # Servidor FastAPI
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Base de Datos (Supabase / PostgreSQL)
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "54322"))
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DB_NAME: str = os.getenv("DB_NAME", "postgres")

    # Persistencia de suscriptores
    SUBSCRIBERS_FILE: Path = BASE_DIR / "subscribers.json"

    # Lógica de inventario
    DEFAULT_STOCK_THRESHOLD: int = 10

settings = Settings()
