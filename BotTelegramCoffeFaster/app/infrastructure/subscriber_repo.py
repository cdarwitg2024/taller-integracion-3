import logging
from typing import Set
from app.infrastructure.database import db_repo

logger = logging.getLogger(__name__)

class SubscriberRepository:
    """
    Fachada de suscriptores sincronizada exclusivamente con la base de datos
    (tabla configuracion_telegram_dueno).
    Garantiza que solo Dueños activos y vinculados formen parte de la lista de difusión.
    """

    def get_all(self) -> Set[int]:
        """Retorna los IDs de Telegram de los dueños activos en la base de datos."""
        try:
            return set(db_repo.obtener_destinatarios_activos())
        except Exception as e:
            logger.error(f"Error obteniendo suscriptores desde DB: {e}")
            return set()

    def exists(self, chat_id: int) -> bool:
        """Comprueba si un chat_id pertenece a un dueño activo en la base de datos."""
        try:
            return db_repo.verificar_dueno_autorizado(chat_id) is not None
        except Exception as e:
            logger.error(f"Error comprobando suscripción para chat {chat_id}: {e}")
            return False

    def add(self, chat_id: int) -> bool:
        """Activa notificaciones si el dueño ya está registrado en DB."""
        return db_repo.actualizar_estado_notificaciones(chat_id, activas=True)

    def remove(self, chat_id: int) -> bool:
        """Pausa notificaciones del dueño registrado en DB."""
        return db_repo.actualizar_estado_notificaciones(chat_id, activas=False)

subscriber_repo = SubscriberRepository()

