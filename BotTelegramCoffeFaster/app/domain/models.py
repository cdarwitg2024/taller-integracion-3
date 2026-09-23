from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class ProductoData(BaseModel):
    """Información del producto enviada por el trigger de Supabase."""
    id: int = Field(..., description="ID único del producto")
    nombre: str = Field(..., description="Nombre comercial del producto")
    stock_actual: int = Field(..., description="Nivel de inventario tras la última venta")
    stock_anterior: int = Field(..., description="Nivel de inventario previo a la venta")
    stock_minimo_configurado: int = Field(..., description="Stock mínimo definido en el producto")
    cafeteria_id: int = Field(..., description="ID de la cafetería asociada")

class AlertaStockPayload(BaseModel):
    """Payload recibido en el endpoint de webhook de pg_net."""
    evento: str = Field(default="ALERTA_STOCK_BAJO", description="Tipo de evento")
    es_prueba: Optional[bool] = Field(default=False, description="Indica si es mensaje de prueba")
    destinatario_chat_id: Optional[int] = Field(default=None, description="Chat ID de Telegram del Dueño destinatario")
    dueno_nombre: Optional[str] = Field(default=None, description="Nombre del Dueño destinatario")
    producto: ProductoData
    umbral_disparo: int = Field(default=10, description="Umbral que disparó la alerta")
    timestamp: datetime = Field(..., description="Fecha y hora del evento")

class DeliveryResult(BaseModel):
    total_destinatarios: int = 0
    exitosos: int = 0
    fallidos: int = 0
    detalles: Optional[str] = None

class AlertaResponse(BaseModel):
    status: str
    message: str
    alerta_db_id: Optional[int] = None
    telegram: DeliveryResult
